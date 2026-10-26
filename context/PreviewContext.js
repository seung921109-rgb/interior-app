"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"
import {
  DEFAULT_IMAGE_VIEW,
  disposeImageSource,
  loadImageSource,
  rasterizeSource,
  sourceSize,
} from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import { normalizeSubjects } from "@/lib/subjects"
import {
  BRUSH_RADIUS,
  cloneMask,
  emptyMask,
  fillHoles,
  isSkinnyMask,
  maskHasSelection,
  stampBrushSegment,
  subtractMask,
  unionMask,
} from "@/lib/mask"
import {
  resizeTargetBuffer,
  toFinishJobs,
  unionTargetMasks,
} from "@/lib/targets"
import {
  createRegionBuffers,
  createRegionMetas,
  regionIdFrom,
  regionNumber,
} from "@/lib/regions"
async function loadPointSegment() {
  if (typeof window === "undefined") {
    return {
      segmentObjectAtPoint: async () => null,
      segmentObjectAtPoints: async () => null,
      warmSegmentModel: async () => {},
      clearSamCache() {},
    }
  }
  return import("@/lib/pointSegment")
}
import {
  bridgeInteriorGaps,
  countMaskOn,
  intersectMasks,
  strictRegionFromPoint,
} from "@/lib/maskConstraint"
import {
  borderBackgroundMask,
  buildLabBuffer,
  expandFromPaint,
  refineSelection,
  smartFillFromMask,
  smoothMask,
  sobelMagnitude,
} from "@/lib/smartMask"
const PreviewContext = createContext(null)

function waitForPaint() {
  if (typeof requestAnimationFrame !== "function") return Promise.resolve()
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve))
  })
}

export function PreviewProvider({ children }) {
  const sourceRef = useRef(null)
  const imageDataRef = useRef(null)
  const labsRef = useRef(null)
  const maskRef = useRef(emptyMask(1))
  const paintRef = useRef(emptyMask(1))
  const targetsRef = useRef([])
  const sizeRef = useRef({ width: 0, height: 0 })
  const paintBumpRaf = useRef(0)
  const fillChainRef = useRef(Promise.resolve())
  const maskOpsRef = useRef({})

  const [fileName, setFileName] = useState("")
  const [hasImage, setHasImage] = useState(false)
  const [hasMask, setHasMask] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState("")
  const processingCountRef = useRef(0)
  const processingOpsRef = useRef({ start() {}, stop() {} })
  const [color, setColorState] = useState(null)
  const [texture, setTextureState] = useState(null)
  const [appliedColor, setAppliedColor] = useState(null)
  const [appliedTexture, setAppliedTexture] = useState(null)
  const [livePreview, setLivePreview] = useState(true)
  const [hint, setHint] = useState("")
  const [subjects, setSubjectsState] = useState([])
  const [targetMetas, setTargetMetas] = useState([])
  const [activeTargetId, setActiveTargetId] = useState("")
  const [promptPoints, setPromptPoints] = useState([])
  const [imageView, setImageViewState] = useState(DEFAULT_IMAGE_VIEW)
  const [peekOriginal, setPeekOriginalState] = useState(false)
  const [version, setVersion] = useState(0)

  function startProcessing(message) {
    processingCountRef.current += 1
    setProcessingMessage(message)
    setIsProcessing(true)
    setAnalyzing(true)
  }

  function stopProcessing() {
    processingCountRef.current = Math.max(0, processingCountRef.current - 1)
    if (processingCountRef.current > 0) return
    setIsProcessing(false)
    setAnalyzing(false)
  }

  processingOpsRef.current.start = startProcessing
  processingOpsRef.current.stop = stopProcessing

  function syncUnionMask() {
    if (!targetsRef.current.length) return
    maskRef.current = unionTargetMasks(targetsRef.current)
    if (paintRef.current.length !== maskRef.current.length) {
      paintRef.current = emptyMask(maskRef.current.length)
    }
  }

  function getActiveBuffer() {
    return (
      targetsRef.current.find((item) => item.id === activeTargetId) ||
      targetsRef.current[0] ||
      null
    )
  }

  function bump(nextHint) {
    if (nextHint !== undefined) setHint(nextHint)
    syncUnionMask()
    const anyMask = targetsRef.current.some((item) =>
      maskHasSelection(item.mask),
    )
    setHasMask(anyMask || maskHasSelection(maskRef.current))
    setTargetMetas((current) =>
      current.map((meta) => {
        const buffer = targetsRef.current.find((item) => item.id === meta.id)
        return {
          ...meta,
          hasMask: buffer ? maskHasSelection(buffer.mask) : false,
        }
      }),
    )
    setVersion((v) => v + 1)
  }

  function ensureWorkingBuffer() {
    if (imageDataRef.current) return imageDataRef.current
    if (!sourceRef.current) return null
    const imageData = rasterizeSource(sourceRef.current, 768)
    if (!imageData) return null
    imageDataRef.current = imageData
    labsRef.current = buildLabBuffer(imageData)
    const n = imageData.width * imageData.height
    if (maskRef.current.length !== n) maskRef.current = emptyMask(n)
    if (paintRef.current.length !== n) paintRef.current = emptyMask(n)
    sizeRef.current = { width: imageData.width, height: imageData.height }
    targetsRef.current = targetsRef.current.map((item) =>
      resizeTargetBuffer(item, n),
    )
    return imageData
  }

  function rememberPrompts(buffer) {
    const next = (buffer?.prompts || []).map((point) => ({
      x: point.x,
      y: point.y,
      label: point.label === 0 ? 0 : 1,
    }))
    setPromptPoints(next)
  }

  function warmSegmentation() {
    const imageData = imageDataRef.current
    if (!imageData || typeof window === "undefined") return
    loadPointSegment()
      .then((mod) => mod.warmSegmentModel?.(imageData))
      .catch(() => {})
  }

  function completeFromCurrentMask() {
    const imageData = imageDataRef.current
    const labs = labsRef.current
    const active = getActiveBuffer()
    const sourceMask = active?.mask || maskRef.current
    const preserve = active?.paint || paintRef.current
    if (!imageData || !labs || !maskHasSelection(sourceMask)) return ""
    const { mask } = smartFillFromMask(imageData, labs, sourceMask, {
      labels: null,
    })
    let next = refineSelection(imageData, labs, mask, null, {
      labels: null,
      preserve,
    })
    next = smoothMask(next, imageData.width, imageData.height)
    if (active) active.mask = next
    else maskRef.current = next
    return "비슷한 색 안쪽을 채우고 거친 경계를 매끄럽게 보정했습니다."
  }

  function protectedByPrompts(imageData, labs, prompts) {
    const n = imageData.width * imageData.height
    let keep = emptyMask(n)
    let any = false
    for (const point of prompts || []) {
      if (point.label === 0) continue
      any = true
      keep = unionMask(keep, strictRegionFromPoint(imageData, labs, point.x, point.y))
    }
    return any ? keep : null
  }

  function writeActiveMask(active, next) {
    if (active) {
      active.mask = next
      active.paint = emptyMask(next.length)
      for (const other of targetsRef.current) {
        if (other.id !== active.id) subtractMask(other.mask, next)
      }
    } else {
      maskRef.current = next
      paintRef.current = emptyMask(next.length)
    }
  }

  function pushPrompt(active, previous, point) {
    if (!active) return
    if (!active.prompts) active.prompts = []
    if (!active.maskHistory) active.maskHistory = []
    active.maskHistory.push(previous)
    active.prompts.push(point)
    if (active.prompts.length > 24) {
      active.prompts.shift()
      active.maskHistory.shift()
    }
    rememberPrompts(active)
  }

  async function addClickPoint(x, y) {
    const imageData = ensureWorkingBuffer()
    const labs = labsRef.current
    const { width, height } = sizeRef.current
    const active = getActiveBuffer()
    if (!imageData || !labs || !width) return
    const label = active?.label || subjects[0] || "영역"
    const px = Math.max(0, Math.min(width - 1, x))
    const py = Math.max(0, Math.min(height - 1, y))
    const previous = cloneMask(active?.mask || maskRef.current)
    const idx = py * width + px
    const inside = previous[idx] > 24 && maskHasSelection(previous)

    if (inside) {
      const cut = strictRegionFromPoint(imageData, labs, px, py)
      const keep = protectedByPrompts(imageData, labs, active?.prompts)
      let removable = 0
      for (let i = 0; i < previous.length; i++) {
        if (cut[i] > 24 && previous[i] > 24 && !(keep && keep[i] > 24)) removable++
      }
      if (removable < 20) {
        bump("이미 잡힌 면입니다. 벽·타일·천장으로 새어 나간 곳을 터치하면 그 부분만 빠집니다.")
        return
      }
      pushPrompt(active, previous, { x: px, y: py, label: 0 })
      const next = cloneMask(previous)
      for (let i = 0; i < next.length; i++) {
        if (cut[i] > 24 && !(keep && keep[i] > 24)) next[i] = 0
      }
      writeActiveMask(active, next)
      bump("새어 나간 부분을 마스크에서 뺐습니다.")
      return
    }

    pushPrompt(active, previous, { x: px, y: py, label: 1 })
    bump(`${label} 경계를 인식하는 중...`)
    startProcessing("AI가 영역을 분석 중입니다...")
    try {
      const points = (active?.prompts || [{ x: px, y: py, label: 1 }]).map((point) => ({
        x: point.x,
        y: point.y,
        label: point.label === 0 ? 0 : 1,
      }))
      let extra = null
      try {
        const { segmentObjectAtPoints } = await loadPointSegment()
        extra = await segmentObjectAtPoints(imageData, points, {
          subject: label,
          targetId: active?.id || "target-0",
          targetIndex: active?.index ?? 0,
        })
      } catch (error) {
        console.warn("point SAM failed", error)
      }
      const allowed = strictRegionFromPoint(imageData, labs, px, py)
      let patch = allowed
      if (extra && !isSkinnyMask(extra, width, height)) {
        const clipped = intersectMasks(extra, allowed)
        if (countMaskOn(clipped) >= 40) patch = clipped
      }
      if (patch[idx] < 24) patch = allowed
      let next = unionMask(previous, patch)
      next = bridgeInteriorGaps(next, width, height, 3)
      writeActiveMask(active, next)
      bump(`${label} 경계를 넘지 않게 이었습니다. 다른 문짝을 터치하면 더 붙습니다.`)
      await waitForPaint()
    } finally {
      stopProcessing()
    }
  }

  function undoLastClick() {
    const { width, height } = sizeRef.current
    const n = Math.max(1, width * height)
    const active = getActiveBuffer()
    if (!active?.prompts?.length) return
    active.prompts.pop()
    const restored = active.maskHistory?.pop()
    active.mask = restored && restored.length === active.mask.length ? cloneMask(restored) : emptyMask(n)
    active.paint = emptyMask(active.mask.length)
    rememberPrompts(active)
    for (const other of targetsRef.current) {
      if (other.id !== active.id) subtractMask(other.mask, active.mask)
    }
    bump(
      active.prompts.length
        ? "마지막 클릭을 취소했습니다."
        : "클릭을 모두 취소해 마스크를 비웠습니다.",
    )
  }

  maskOpsRef.current.addClickPoint = addClickPoint
  maskOpsRef.current.undoLastClick = undoLastClick

  const api = useMemo(
    () => ({
      fileName,
      hasImage,
      hasMask,
      analyzing,
      isProcessing,
      processingMessage,
      color,
      texture,
      appliedColor,
      appliedTexture,
      livePreview,
      displayColor:
        (targetMetas.find((item) => item.id === activeTargetId) || targetMetas[0])
          ?.color ||
        (targetMetas.find((item) => item.id === activeTargetId) || targetMetas[0])
          ?.appliedColor ||
        color ||
        appliedColor,
      displayTexture:
        (targetMetas.find((item) => item.id === activeTargetId) || targetMetas[0])
          ?.texture ||
        (targetMetas.find((item) => item.id === activeTargetId) || targetMetas[0])
          ?.appliedTexture ||
        texture ||
        appliedTexture,
      hint,
      promptPoints,
      imageView,
      peekOriginal,
      subjects,
      subject: subjects[0] || "",
      targets: targetMetas,
      regions: Object.fromEntries(
        targetMetas.map((meta) => {
          const buffer = targetsRef.current.find((item) => item.id === meta.id)
          return [
            meta.id,
            {
              id: meta.id,
              label: meta.label,
              index: meta.index,
              mask: buffer?.mask || emptyMask(1),
              prompts: (buffer?.prompts || []).map((point) => ({
                x: point.x,
                y: point.y,
                label: point.label === 0 ? 0 : 1,
              })),
              color: meta.color,
              texture: meta.texture,
              appliedColor: meta.appliedColor,
              appliedTexture: meta.appliedTexture,
              hasMask: meta.hasMask,
            },
          ]
        }),
      ),
      activeTargetId,
      activeTarget: regionNumber(activeTargetId),
      version,
      getSource: () => sourceRef.current,
      getImageData: () => imageDataRef.current,
      getMask: () => maskRef.current,
      getSize: () => sizeRef.current,
      setImageView(next) {
        setImageViewState((current) => {
          const view = typeof next === "function" ? next(current) : next
          if (!view) return DEFAULT_IMAGE_VIEW
          return {
            scale: view.scale,
            u: view.u,
            v: view.v,
          }
        })
      },
      setPeekOriginal(next) {
        setPeekOriginalState(Boolean(next))
      },
      setSubjects(nextSubjects) {
        const next = normalizeSubjects(nextSubjects)
        setSubjectsState(next)
        return next.slice()
      },
      getSubjects() {
        return subjects.slice()
      },
      setActiveTarget(id) {
        const nextId = regionIdFrom(id)
        const meta = targetMetas.find((item) => item.id === nextId)
        if (!meta) return
        setActiveTargetId(nextId)
        rememberPrompts(targetsRef.current.find((item) => item.id === nextId))
        setColorState(meta.color)
        setTextureState(meta.texture)
        setAppliedColor(meta.appliedColor)
        setAppliedTexture(meta.appliedTexture)
        bump(`${meta.label}에만 마스크와 마감이 쌓입니다.`)
      },
      getFinishJobs() {
        return toFinishJobs(targetMetas, targetsRef.current)
      },
      prepareFrame() {
        if (!sourceRef.current) return null
        return ensureWorkingBuffer()
      },
      paintBrush(from, to, radius = BRUSH_RADIUS, value = 255) {
        const { width, height } = sizeRef.current
        if (!width || !height) return
        const active = getActiveBuffer()
        const targetMask = active?.mask || maskRef.current
        const targetPaint = active?.paint || paintRef.current
        if (targetMask.length !== width * height) return
        const tone = value > 0 ? 255 : 0
        stampBrushSegment(targetMask, width, height, from, to, radius, tone)
        stampBrushSegment(targetPaint, width, height, from, to, radius, tone)
        if (paintBumpRaf.current) return
        paintBumpRaf.current = requestAnimationFrame(() => {
          paintBumpRaf.current = 0
          bump()
        })
      },
      fillFromPoint(x, y) {
        const job = fillChainRef.current.then(() => maskOpsRef.current.addClickPoint(x, y))
        fillChainRef.current = job.catch(() => {})
        return job
      },
      undoClickPoint() {
        const job = fillChainRef.current.then(() => maskOpsRef.current.undoLastClick())
        fillChainRef.current = job.catch(() => {})
        return job
      },
      async smartFill() {
        const message = completeFromCurrentMask()
        if (message) bump(message)
      },
      async refineRegion() {
        const imageData = imageDataRef.current
        const labs = labsRef.current
        const active = getActiveBuffer()
        const sourceMask = active?.mask || maskRef.current
        if (!imageData || !labs || !maskHasSelection(sourceMask)) return
        let next = smoothMask(
          sourceMask,
          imageData.width,
          imageData.height,
        )
        next = refineSelection(imageData, labs, next, null, {
          labels: null,
          preserve: active?.paint || paintRef.current,
        })
        next = smoothMask(next, imageData.width, imageData.height)
        if (active) active.mask = next
        else maskRef.current = next
        bump("거친 경계를 부드럽게 다듬었습니다.")
      },
      async autoCompleteSelection() {
        const imageData = imageDataRef.current
        const labs = labsRef.current
        const { width, height } = sizeRef.current
        if (imageData && labs && maskHasSelection(paintRef.current)) {
          maskRef.current = expandFromPaint(
            imageData,
            labs,
            maskRef.current,
            paintRef.current,
            {
              background: borderBackgroundMask(labs, width, height),
              edgeMag: sobelMagnitude(imageData),
            },
          )
        }
        const message = completeFromCurrentMask()
        paintRef.current = emptyMask(maskRef.current.length)
        bump(message || "영역을 채우고 윤곽을 정리했습니다.")
      },
      async sealPaintedSelection() {
        const imageData = imageDataRef.current
        const labs = labsRef.current
        const { width, height } = sizeRef.current
        if (!imageData || !labs || !width) return
        const previous = cloneMask(maskRef.current)
        const background = borderBackgroundMask(labs, width, height)
        let next = expandFromPaint(
          imageData,
          labs,
          maskRef.current,
          paintRef.current,
          {
            background,
            edgeMag: sobelMagnitude(imageData),
          },
        )
        next = refineSelection(imageData, labs, next, null, {
          labels: null,
          background,
          preserve: unionMask(previous, paintRef.current),
        })
        next = smoothMask(next, width, height)
        maskRef.current = next
        fillHoles(maskRef.current, width, height)
        paintRef.current = emptyMask(maskRef.current.length)
        bump("덧칠한 부분을 영역에 반영했습니다.")
      },
      resetArea() {
        const { width, height } = sizeRef.current
        const n = Math.max(1, width * height)
        const active = getActiveBuffer()
        if (active) {
          active.mask = emptyMask(n)
          active.paint = emptyMask(n)
          active.prompts = []
          active.maskHistory = []
        }
        maskRef.current = emptyMask(n)
        paintRef.current = emptyMask(n)
        setPromptPoints([])
        setTargetMetas((current) =>
          current.map((meta) =>
            meta.id === (active?.id || activeTargetId)
              ? {
                  ...meta,
                  hasMask: false,
                  color: null,
                  texture: null,
                  appliedColor: null,
                  appliedTexture: null,
                }
              : meta,
          ),
        )
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("이 영역의 마스크와 마감을 비웠습니다.")
      },
      resetStyle() {
        const active = getActiveBuffer()
        const id = active?.id || activeTargetId
        setTargetMetas((current) =>
          current.map((meta) =>
            meta.id === id
              ? {
                  ...meta,
                  color: null,
                  texture: null,
                  appliedColor: null,
                  appliedTexture: null,
                }
              : meta,
          ),
        )
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("이 영역의 색과 필름을 비웠습니다. 선택한 영역은 그대로입니다.")
      },
      resetMask() {
        const { width, height } = sizeRef.current
        const n = Math.max(1, width * height)
        const active = getActiveBuffer()
        if (active) {
          active.mask = emptyMask(n)
          active.paint = emptyMask(n)
          active.prompts = []
          active.maskHistory = []
        }
        maskRef.current = emptyMask(n)
        paintRef.current = emptyMask(n)
        setPromptPoints([])
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("이 영역의 마스크와 마감을 비웠습니다.")
      },
      commitSimulation() {
        setTargetMetas((current) =>
          current.map((meta) => ({
            ...meta,
            appliedColor: meta.color,
            appliedTexture: meta.texture,
          })),
        )
        setAppliedColor(color)
        setAppliedTexture(texture)
        bump("변환을 적용했습니다.")
      },
      lockLivePreview() {
        setLivePreview(false)
      },
      unlockLivePreview() {
        setLivePreview(true)
      },
      setColor(next) {
        setColorState(next)
        setTargetMetas((current) =>
          current.map((meta) =>
            meta.id === activeTargetId ? { ...meta, color: next } : meta,
          ),
        )
        bump(
          next
            ? "선택한 컬러로 바로 바꿨습니다."
            : "컬러 적용을 해제했습니다.",
        )
      },
      setTexture(next) {
        setTextureState(next)
        setTargetMetas((current) =>
          current.map((meta) =>
            meta.id === activeTargetId ? { ...meta, texture: next } : meta,
          ),
        )
        bump(
          next
            ? "선택한 필름지로 바로 바꿔 끼웠습니다."
            : "필름 적용을 해제했습니다.",
        )
      },
      clearFinish() {
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setTargetMetas((current) =>
          current.map((meta) => ({
            ...meta,
            color: null,
            texture: null,
            appliedColor: null,
            appliedTexture: null,
          })),
        )
        bump("원본 사진으로 되돌렸습니다. 영역은 그대로입니다.")
      },
      getFinishedImage() {
        const imageData = imageDataRef.current
        if (!imageData) return null
        return applyFinish(
          imageData,
          maskRef.current,
          appliedColor || color,
          appliedTexture || texture,
          toFinishJobs(targetMetas, targetsRef.current),
        )
      },
      startProcessing(message) {
        processingOpsRef.current.start(message)
      },
      stopProcessing() {
        processingOpsRef.current.stop()
      },
      async loadFile(file) {
        const isImage =
          (file.type && file.type.startsWith("image/")) ||
          /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name || "")
        if (!isImage) {
          throw new Error("이미지 파일만 업로드할 수 있습니다.")
        }
        processingOpsRef.current.start("이미지 업로드 중...")
        try {
          const source = await loadImageSource(file)
          const { width: sourceWidth, height: sourceHeight } = sourceSize(source)
          if (!sourceWidth || !sourceHeight) {
            disposeImageSource(source)
            throw new Error("사진을 읽었지만 화면에 그릴 수 없습니다. JPG/PNG로 다시 올려 주세요.")
          }
          disposeImageSource(sourceRef.current)
          sourceRef.current = source
          imageDataRef.current = null
          labsRef.current = null
          maskRef.current = emptyMask(1)
          paintRef.current = emptyMask(1)
          sizeRef.current = { width: 0, height: 0 }
          ensureWorkingBuffer()
          try {
            const { clearSamCache } = await loadPointSegment()
            clearSamCache()
          } catch {
            // SAM cache is browser-only
          }
          setFileName(file.name)
          setHasImage(true)
          setSubjectsState([])
          const n = Math.max(1, sizeRef.current.width * sizeRef.current.height)
          targetsRef.current = createRegionBuffers(n)
          setTargetMetas(createRegionMetas())
          setActiveTargetId("region1")
          setPromptPoints([])
          setImageViewState(DEFAULT_IMAGE_VIEW)
          setPeekOriginalState(false)
          setColorState(null)
          setTextureState(null)
          setAppliedColor(null)
          setAppliedTexture(null)
          setLivePreview(true)
          warmSegmentation()
          bump("영역 1이 선택되어 있습니다. 면을 터치하면 이 영역에만 마스크가 쌓입니다.")
          await waitForPaint()
        } finally {
          processingOpsRef.current.stop()
        }
      },
    }),
    [
      fileName,
      hasImage,
      hasMask,
      analyzing,
      isProcessing,
      processingMessage,
      color,
      texture,
      appliedColor,
      appliedTexture,
      livePreview,
      hint,
      promptPoints,
      imageView,
      peekOriginal,
      subjects,
      targetMetas,
      activeTargetId,
      version,
    ],
  )

  return (
    <PreviewContext.Provider value={api}>{children}</PreviewContext.Provider>
  )
}

export function usePreview() {
  const value = useContext(PreviewContext)
  if (!value) {
    throw new Error("usePreview must be used within PreviewProvider")
  }
  return value
}

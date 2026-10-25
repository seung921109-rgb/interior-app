"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"
import {
  disposeImageSource,
  loadImageSource,
  rasterizeSource,
  sourceSize,
} from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import { canCommitSubjects, normalizeSubjects } from "@/lib/subjects"
import {
  BRUSH_RADIUS,
  cloneMask,
  emptyMask,
  fillHoles,
  isSkinnyMask,
  maskHasSelection,
  solidifyMask,
  stampBrushSegment,
  subtractMask,
  unionMask,
} from "@/lib/mask"
import {
  createTargetBuffer,
  createTargetMeta,
  resizeTargetBuffer,
  toFinishJobs,
  unionTargetMasks,
} from "@/lib/targets"
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
  COLOR_TOLERANCE,
  borderBackgroundMask,
  buildLabBuffer,
  expandFromPaint,
  refineSelection,
  smartFillFromMask,
  smartFloodFill,
  snapMaskToEdges,
  snapWorkingPointToEdge,
  smoothMask,
  sobelMagnitude,
} from "@/lib/smartMask"
const PreviewContext = createContext(null)

export function PreviewProvider({ children }) {
  const sourceRef = useRef(null)
  const imageDataRef = useRef(null)
  const labsRef = useRef(null)
  const maskRef = useRef(emptyMask(1))
  const paintRef = useRef(emptyMask(1))
  const targetsRef = useRef([])
  const sizeRef = useRef({ width: 0, height: 0 })
  const paintBumpRaf = useRef(0)

  const [fileName, setFileName] = useState("")
  const [hasImage, setHasImage] = useState(false)
  const [hasMask, setHasMask] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
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
  const [version, setVersion] = useState(0)

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

  const api = useMemo(
    () => ({
      fileName,
      hasImage,
      hasMask,
      analyzing,
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
      subjects,
      subject: subjects[0] || "",
      targets: targetMetas,
      activeTargetId,
      version,
      getSource: () => sourceRef.current,
      getImageData: () => imageDataRef.current,
      getMask: () => maskRef.current,
      getSize: () => sizeRef.current,
      setSubjects(nextSubjects) {
        const next = normalizeSubjects(nextSubjects)
        if (next.length === 0) {
          targetsRef.current = []
          setSubjectsState([])
          setTargetMetas([])
          setActiveTargetId("")
          setPromptPoints([])
          return []
        }
        if (!canCommitSubjects(next)) return subjects.slice()
        const { width, height } = sizeRef.current
        const n = Math.max(1, width * height)
        targetsRef.current = next.map((label, index) =>
          createTargetBuffer(label, index, n),
        )
        const metas = next.map((label, index) => createTargetMeta(label, index))
        setSubjectsState(next)
        setTargetMetas(metas)
        setActiveTargetId(metas[0]?.id || "")
        setPromptPoints([])
        warmSegmentation()
        bump(
          next.length > 1
            ? `${next.join(", ")} 중 대상을 고른 뒤 영역을 터치하세요.`
            : `${next[0]} 영역을 터치하면 그 자리의 경계로 마스크를 만듭니다.`,
        )
        return next.slice()
      },
      getSubjects() {
        return subjects.slice()
      },
      setActiveTarget(id) {
        const meta = targetMetas.find((item) => item.id === id)
        if (!meta) return
        setActiveTargetId(id)
        rememberPrompts(targetsRef.current.find((item) => item.id === id))
        setColorState(meta.color)
        setTextureState(meta.texture)
        setAppliedColor(meta.appliedColor)
        setAppliedTexture(meta.appliedTexture)
        bump(`${meta.label}을 선택했습니다. 영역을 지정하거나 마감을 입히세요.`)
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
      async fillFromPoint(x, y) {
        const imageData = ensureWorkingBuffer()
        const labs = labsRef.current
        const { width, height } = sizeRef.current
        const active = getActiveBuffer()
        if (!imageData || !labs || !width) return
        const label = active?.label || subjects[0] || "영역"
        const px = Math.max(0, Math.min(width - 1, x))
        const py = Math.max(0, Math.min(height - 1, y))
        if (active) {
          if (!active.prompts) active.prompts = []
          active.prompts.push({ x: px, y: py, label: 1 })
          if (active.prompts.length > 12) active.prompts.shift()
          rememberPrompts(active)
        }
        bump(`${label} 경계를 인식하는 중...`)
        setAnalyzing(true)
        const previous = cloneMask(active?.mask || maskRef.current)
        let extra = null
        try {
          const { segmentObjectAtPoints } = await loadPointSegment()
          extra = await segmentObjectAtPoints(imageData, [{ x: px, y: py, label: 1 }], {
            subject: label,
            targetId: active?.id || "target-0",
            targetIndex: active?.index ?? 0,
          })
        } catch (error) {
          console.warn("point SAM failed", error)
        } finally {
          setAnalyzing(false)
        }
        let patch = extra
        if (extra && !isSkinnyMask(extra, width, height)) {
          patch = solidifyMask(extra, width, height)
        } else {
          const seed = snapWorkingPointToEdge(imageData, px, py)
          const flood = smartFloodFill(imageData, labs, seed.x, seed.y, COLOR_TOLERANCE)
          patch = solidifyMask(extra ? unionMask(extra, flood) : flood, width, height)
          patch = snapMaskToEdges(imageData, labs, patch, 5)
          patch = smoothMask(patch, width, height)
          if (isSkinnyMask(patch, width, height)) {
            patch = solidifyMask(unionMask(patch, flood), width, height)
          }
        }
        let shared = 0
        let patchCount = 0
        for (let i = 0; i < patch.length; i++) {
          if (patch[i] < 24) continue
          patchCount++
          if (previous[i] >= 24) shared++
        }
        const sameSurface = patchCount > 0 && shared / patchCount >= 0.22
        const next = sameSurface || !maskHasSelection(previous) ? unionMask(previous, patch) : patch
        fillHoles(next, width, height)
        if (active && !sameSurface && maskHasSelection(previous)) {
          active.prompts = [{ x: px, y: py, label: 1 }]
          rememberPrompts(active)
        }
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
        bump(
          sameSurface || !maskHasSelection(previous)
            ? `${label} 면을 원근에 맞춰 잡았습니다. 텍스처가 그 면을 따라 붙습니다.`
            : `${label} 면을 새로 잡았습니다. 텍스처가 그 면을 따라 붙습니다.`,
        )
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
        bump("영역을 초기화했습니다. 가구를 다시 지정하세요.")
      },
      resetMask() {
        const { width, height } = sizeRef.current
        const n = Math.max(1, width * height)
        const active = getActiveBuffer()
        if (active) {
          active.mask = emptyMask(n)
          active.paint = emptyMask(n)
          active.prompts = []
        }
        maskRef.current = emptyMask(n)
        paintRef.current = emptyMask(n)
        setPromptPoints([])
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("영역을 초기화했습니다. 가구를 다시 지정하세요.")
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
      async loadFile(file) {
        const isImage =
          (file.type && file.type.startsWith("image/")) ||
          /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name || "")
        if (!isImage) {
          throw new Error("이미지 파일만 업로드할 수 있습니다.")
        }
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
        targetsRef.current = []
        setTargetMetas([])
        setActiveTargetId("")
        setPromptPoints([])
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        warmSegmentation()
        bump("사진이 올라왔습니다. 바꿀 사물이나 영역을 최대 2개까지 고르세요.")
      },
    }),
    [
      fileName,
      hasImage,
      hasMask,
      analyzing,
      color,
      texture,
      appliedColor,
      appliedTexture,
      livePreview,
      hint,
      promptPoints,
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

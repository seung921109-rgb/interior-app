"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"
import { allowedLabelsForSeed, labelInKorean } from "@/lib/adeClasses"
import {
  disposeImageSource,
  loadImageSource,
  rasterizeCover,
  sourceSize,
} from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import {
  BRUSH_RADIUS,
  cloneMask,
  emptyMask,
  fillHoles,
  maskHasSelection,
  scaleMask,
  stampBrushSegment,
  unionMask,
} from "@/lib/mask"
import { SCENE_LABELS } from "@/lib/adeClasses"
import { segmentScene } from "@/lib/segmentFurniture"
import {
  borderBackgroundMask,
  buildLabBuffer,
  connectedLabelMask,
  expandFromPaint,
  floodFill,
  majorityLabel,
  refineSelection,
  smartFillFromMask,
  sobelMagnitude,
} from "@/lib/smartMask"
const PreviewContext = createContext(null)

function scaleLabels(labels, oldWidth, oldHeight, width, height) {
  const out = new Array(width * height).fill("")
  if (!labels?.length || !oldWidth || !oldHeight) return out
  for (let y = 0; y < height; y++) {
    const sy = Math.min(oldHeight - 1, Math.floor((y * oldHeight) / height))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(oldWidth - 1, Math.floor((x * oldWidth) / width))
      out[y * width + x] = labels[sy * oldWidth + sx]
    }
  }
  return out
}

export function PreviewProvider({ children }) {
  const sourceRef = useRef(null)
  const imageDataRef = useRef(null)
  const labsRef = useRef(null)
  const labelsRef = useRef(null)
  const maskRef = useRef(emptyMask(1))
  const paintRef = useRef(emptyMask(1))
  const sizeRef = useRef({ width: 0, height: 0 })
  const segmentPromiseRef = useRef(null)
  const analysisGenRef = useRef(0)

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
  const [version, setVersion] = useState(0)

  function bump(nextHint) {
    if (nextHint !== undefined) setHint(nextHint)
    setHasMask(maskHasSelection(maskRef.current))
    setVersion((v) => v + 1)
  }

  async function analyze(imageData) {
    const gen = ++analysisGenRef.current
    const srcW = imageData.width
    const srcH = imageData.height
    setAnalyzing(true)
    try {
      const { labels } = await segmentScene(imageData)
      if (gen !== analysisGenRef.current) return
      const { width, height } = sizeRef.current
      labelsRef.current =
        width === srcW && height === srcH
          ? labels
          : scaleLabels(labels, srcW, srcH, width, height)
    } catch (error) {
      if (gen !== analysisGenRef.current) return
      console.warn("furniture segmentation failed", error)
      labelsRef.current = null
    } finally {
      if (gen === analysisGenRef.current) setAnalyzing(false)
    }
  }

  function labelsForSize(width, height) {
    const labels = labelsRef.current
    if (!labels || labels.length !== width * height) return null
    return labels
  }

  function syncWorkingSize(width, height) {
    const prev = sizeRef.current
    if (prev.width === width && prev.height === height && imageDataRef.current) {
      return imageDataRef.current
    }

    const imageData = rasterizeCover(sourceRef.current, width, height)
    imageDataRef.current = imageData
    labsRef.current = buildLabBuffer(imageData)
    maskRef.current = scaleMask(
      maskRef.current,
      prev.width,
      prev.height,
      width,
      height,
    )
    paintRef.current = scaleMask(
      paintRef.current,
      prev.width,
      prev.height,
      width,
      height,
    )
    labelsRef.current = scaleLabels(
      labelsRef.current,
      prev.width,
      prev.height,
      width,
      height,
    )
    const significant =
      !prev.width ||
      Math.abs(prev.width - width) > 24 ||
      Math.abs(prev.height - height) > 24
    sizeRef.current = { width, height }
    if (significant) {
      segmentPromiseRef.current = analyze(imageData)
    }
    return imageData
  }

  async function waitForLabels() {
    if (segmentPromiseRef.current) {
      try {
        await segmentPromiseRef.current
      } catch {
        // fallback to color/edge fill
      }
    }
  }

  function completeFromCurrentMask() {
    const imageData = imageDataRef.current
    const labs = labsRef.current
    if (!imageData || !labs || !maskHasSelection(maskRef.current)) return ""
    const labels = labelsForSize(imageData.width, imageData.height)
    const { mask, seedLabel } = smartFillFromMask(imageData, labs, maskRef.current, {
      labels,
    })
    const allowed = seedLabel ? allowedLabelsForSeed(seedLabel) : null
    const classGuide =
      labels && allowed && seedLabel !== "furniture"
        ? connectedLabelMask(labels, mask, imageData.width, imageData.height, allowed)
        : null
    maskRef.current = refineSelection(imageData, labs, mask, classGuide, {
      labels,
      preserve: paintRef.current,
    })
    const name = labelInKorean(seedLabel)
    if (name) return `${name} 안쪽을 채우고 경계를 다듬었습니다.`
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
      displayColor: livePreview ? color : appliedColor,
      displayTexture: livePreview ? texture : appliedTexture,
      hint,
      version,
      getSource: () => sourceRef.current,
      getImageData: () => imageDataRef.current,
      getMask: () => maskRef.current,
      getSize: () => sizeRef.current,
      prepareFrame(width, height) {
        if (!sourceRef.current) return null
        return syncWorkingSize(width, height)
      },
      paintBrush(from, to, radius = BRUSH_RADIUS) {
        const { width, height } = sizeRef.current
        if (!width || !height) return
        if (maskRef.current.length !== width * height) {
          maskRef.current = emptyMask(width * height)
        }
        if (paintRef.current.length !== maskRef.current.length) {
          paintRef.current = emptyMask(maskRef.current.length)
        }
        stampBrushSegment(maskRef.current, width, height, from, to, radius)
        stampBrushSegment(paintRef.current, width, height, from, to, radius)
        bump()
      },
      async fillFromPoint(x, y) {
        const imageData = imageDataRef.current
        const labs = labsRef.current
        const { width, height } = sizeRef.current
        if (!imageData || !labs || !width) return
        const background = borderBackgroundMask(labs, width, height)
        const labels = labelsForSize(width, height)
        const seedIndex =
          Math.max(0, Math.min(height - 1, Math.round(y))) * width +
          Math.max(0, Math.min(width - 1, Math.round(x)))
        const tapLabel = labels?.[seedIndex]
        const tapOnWallBg = Boolean(background[seedIndex])
        const selectingScene = tapOnWallBg && tapLabel && SCENE_LABELS.has(tapLabel)
        const extra = floodFill(labs, width, height, x, y, 26, {
          background: selectingScene ? null : background,
          labels,
          blockedLabels:
            selectingScene || (tapLabel && SCENE_LABELS.has(tapLabel) && tapOnWallBg)
              ? null
              : tapLabel && !SCENE_LABELS.has(tapLabel)
                ? new Set(["wall", "floor", "ceiling", "sky"])
                : null,
          edgeMag: sobelMagnitude(imageData),
        })
        const previous = cloneMask(maskRef.current)
        const patch = refineSelection(imageData, labs, extra, null, {
          labels,
          background,
          preserve: extra,
        })
        maskRef.current = unionMask(previous, patch)
        fillHoles(maskRef.current, width, height)
        paintRef.current = emptyMask(maskRef.current.length)
        bump("터치한 위치의 비슷한 색을 채우고 경계를 보정했습니다.")
      },
      async smartFill() {
        await waitForLabels()
        const message = completeFromCurrentMask()
        if (message) bump(message)
      },
      async refineRegion() {
        await waitForLabels()
        const imageData = imageDataRef.current
        const labs = labsRef.current
        if (!imageData || !labs || !maskHasSelection(maskRef.current)) return
        const labels = labelsForSize(imageData.width, imageData.height)
        const seedLabel = labels ? majorityLabel(labels, maskRef.current) : ""
        const allowed = seedLabel ? allowedLabelsForSeed(seedLabel) : null
        const classGuide = labels
          ? connectedLabelMask(
              labels,
              maskRef.current,
              imageData.width,
              imageData.height,
              allowed,
            )
          : null
        const refineGuide =
          labels && allowed && seedLabel && !SCENE_LABELS.has(seedLabel)
            ? classGuide
            : null
        maskRef.current = refineSelection(
          imageData,
          labs,
          maskRef.current,
          refineGuide,
          { labels, preserve: paintRef.current },
        )
        bump(
          seedLabel
            ? `${labelInKorean(seedLabel)} 윤곽에 맞춰 정리했습니다.`
            : "경계를 가구 윤곽에 맞춰 정리했습니다.",
        )
      },
      async autoCompleteSelection() {
        bump("가구를 분류하고 외곽을 맞추는 중...")
        await waitForLabels()
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
              labels: labelsForSize(width, height),
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
        await waitForLabels()
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
            labels: labelsForSize(width, height),
            background,
            edgeMag: sobelMagnitude(imageData),
          },
        )
        next = refineSelection(imageData, labs, next, null, {
          labels: labelsForSize(width, height),
          background,
          preserve: unionMask(previous, paintRef.current),
        })
        maskRef.current = next
        fillHoles(maskRef.current, width, height)
        paintRef.current = emptyMask(maskRef.current.length)
        bump("덧칠한 부분을 영역에 반영했습니다.")
      },
      resetArea() {
        const { width, height } = sizeRef.current
        const n = Math.max(1, width * height)
        maskRef.current = emptyMask(n)
        paintRef.current = emptyMask(n)
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
        maskRef.current = emptyMask(n)
        paintRef.current = emptyMask(n)
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("영역을 초기화했습니다. 가구를 다시 지정하세요.")
      },
      commitSimulation() {
        setAppliedColor(color)
        setAppliedTexture(texture)
        bump("변환을 적용했습니다.")
      },
      lockLivePreview() {
        setLivePreview(false)
      },
      setColor(next) {
        setColorState(next)
        bump(
          next
            ? "선택한 컬러로 바로 바꿨습니다."
            : "컬러 적용을 해제했습니다.",
        )
      },
      setTexture(next) {
        setTextureState(next)
        bump(
          next
            ? "선택한 필름지로 바로 바꿔 끼웠습니다."
            : "필름 적용을 해제했습니다.",
        )
      },
      getFinishedImage() {
        const imageData = imageDataRef.current
        if (!imageData) return null
        return applyFinish(
          imageData,
          maskRef.current,
          appliedColor || color,
          appliedTexture || texture,
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
        labelsRef.current = null
        maskRef.current = emptyMask(1)
        paintRef.current = emptyMask(1)
        sizeRef.current = { width: 0, height: 0 }
        analysisGenRef.current += 1
        segmentPromiseRef.current = null
        setFileName(file.name)
        setHasImage(true)
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("가구를 터치하거나 테두리를 칠하면 안쪽이 자동으로 채워집니다.")
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

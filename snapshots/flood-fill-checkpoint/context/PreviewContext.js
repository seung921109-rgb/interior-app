"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"
import { allowedLabelsForSeed, labelInKorean } from "@/lib/adeClasses"
import { loadImageSource, rasterizeCover } from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import {
  BRUSH_RADIUS,
  emptyMask,
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
  floodFill,
  majorityLabel,
  refineSelection,
  smartFillFromMask,
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
  const sizeRef = useRef({ width: 0, height: 0 })
  const segmentPromiseRef = useRef(null)

  const [fileName, setFileName] = useState("")
  const [hasImage, setHasImage] = useState(false)
  const [hasMask, setHasMask] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [color, setColor] = useState(null)
  const [texture, setTexture] = useState(null)
  const [hint, setHint] = useState("")
  const [version, setVersion] = useState(0)

  function bump(nextHint) {
    if (nextHint !== undefined) setHint(nextHint)
    setHasMask(maskHasSelection(maskRef.current))
    setVersion((v) => v + 1)
  }

  async function analyze(imageData) {
    setAnalyzing(true)
    try {
      const { labels } = await segmentScene(imageData)
      labelsRef.current = labels
    } catch (error) {
      console.warn("furniture segmentation failed", error)
      labelsRef.current = null
    } finally {
      setAnalyzing(false)
    }
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
    labelsRef.current = scaleLabels(
      labelsRef.current,
      prev.width,
      prev.height,
      width,
      height,
    )
    sizeRef.current = { width, height }
    segmentPromiseRef.current = analyze(imageData)
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
    const labels = labelsRef.current
    const { mask, seedLabel } = smartFillFromMask(imageData, labs, maskRef.current, {
      labels,
    })
    const allowed = seedLabel ? allowedLabelsForSeed(seedLabel) : null
    const classGuide = labels
      ? connectedLabelMask(labels, mask, imageData.width, imageData.height, allowed)
      : null
    maskRef.current = refineSelection(imageData, labs, mask, classGuide)
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
        stampBrushSegment(maskRef.current, width, height, from, to, radius)
        bump()
      },
      async fillFromPoint(x, y) {
        const imageData = imageDataRef.current
        const labs = labsRef.current
        const { width, height } = sizeRef.current
        if (!imageData || !labs || !width) return
        await waitForLabels()
        const background = borderBackgroundMask(labs, width, height)
        const labels = labelsRef.current
        const seedIndex =
          Math.max(0, Math.min(height - 1, Math.round(y))) * width +
          Math.max(0, Math.min(width - 1, Math.round(x)))
        const tapLabel = labels?.[seedIndex]
        const extra = floodFill(labs, width, height, x, y, 28, {
          background: tapLabel && SCENE_LABELS.has(tapLabel) ? null : background,
          labels,
          blockedLabels:
            tapLabel && SCENE_LABELS.has(tapLabel)
              ? null
              : new Set(["wall", "floor", "ceiling", "sky"]),
        })
        maskRef.current = unionMask(maskRef.current, extra)
        const seedLabel = labels ? majorityLabel(labels, extra) : ""
        const allowed = seedLabel ? allowedLabelsForSeed(seedLabel) : null
        const classGuide = labels
          ? connectedLabelMask(labels, extra, width, height, allowed)
          : null
        maskRef.current = refineSelection(
          imageData,
          labs,
          maskRef.current,
          classGuide,
        )
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
        const labels = labelsRef.current
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
        maskRef.current = refineSelection(
          imageData,
          labs,
          maskRef.current,
          classGuide,
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
        const message = completeFromCurrentMask()
        bump(message || "영역을 채우고 윤곽을 정리했습니다.")
      },
      resetMask() {
        const { width, height } = sizeRef.current
        maskRef.current = emptyMask(Math.max(1, width * height))
        bump("영역을 지웠습니다. 다시 드래그해 선택하세요.")
      },
      setColor,
      setTexture,
      getFinishedImage() {
        const imageData = imageDataRef.current
        if (!imageData) return null
        return applyFinish(imageData, maskRef.current, color, texture)
      },
      async loadFile(file) {
        if (!file.type.startsWith("image/")) {
          throw new Error("이미지 파일만 업로드할 수 있습니다.")
        }
        const source = await loadImageSource(file)
        if (sourceRef.current && typeof sourceRef.current.close === "function") {
          sourceRef.current.close()
        }
        sourceRef.current = source
        imageDataRef.current = null
        labsRef.current = null
        labelsRef.current = null
        maskRef.current = emptyMask(1)
        sizeRef.current = { width: 0, height: 0 }
        setFileName(file.name)
        setHasImage(true)
        setColor(null)
        setTexture(null)
        bump("가구를 터치하거나 테두리를 칠하면 안쪽이 자동으로 채워집니다.")
      },
    }),
    [fileName, hasImage, hasMask, analyzing, color, texture, hint, version],
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

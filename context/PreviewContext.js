"use client"

import { createContext, useContext, useMemo, useRef, useState } from "react"
import {
  disposeImageSource,
  loadImageSource,
  rasterizeSource,
  sourceSize,
} from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import {
  BRUSH_RADIUS,
  cloneMask,
  emptyMask,
  fillHoles,
  maskHasSelection,
  stampBrushSegment,
  unionMask,
} from "@/lib/mask"
import { clearSamCache, segmentObjectAtPoint } from "@/lib/pointSegment"
import {
  COLOR_TOLERANCE,
  borderBackgroundMask,
  buildLabBuffer,
  expandFromPaint,
  refineSelection,
  smartFillFromMask,
  smartFloodFill,
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
  const sizeRef = useRef({ width: 0, height: 0 })

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
    return imageData
  }

  function completeFromCurrentMask() {
    const imageData = imageDataRef.current
    const labs = labsRef.current
    if (!imageData || !labs || !maskHasSelection(maskRef.current)) return ""
    const { mask } = smartFillFromMask(imageData, labs, maskRef.current, {
      labels: null,
    })
    let next = refineSelection(imageData, labs, mask, null, {
      labels: null,
      preserve: paintRef.current,
    })
    next = smoothMask(next, imageData.width, imageData.height)
    maskRef.current = next
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
      displayColor: color || appliedColor,
      displayTexture: texture || appliedTexture,
      hint,
      version,
      getSource: () => sourceRef.current,
      getImageData: () => imageDataRef.current,
      getMask: () => maskRef.current,
      getSize: () => sizeRef.current,
      prepareFrame() {
        if (!sourceRef.current) return null
        return ensureWorkingBuffer()
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
        const imageData = ensureWorkingBuffer()
        const labs = labsRef.current
        const { width, height } = sizeRef.current
        if (!imageData || !labs || !width) return
        bump("클릭한 좌표의 가구 외곽선을 인식하는 중...")
        setAnalyzing(true)
        const previous = cloneMask(maskRef.current)
        let extra = null
        try {
          extra = await segmentObjectAtPoint(imageData, x, y)
        } catch (error) {
          console.warn("point SAM failed", error)
        } finally {
          setAnalyzing(false)
        }
        if (!extra) {
          extra = smartFloodFill(imageData, labs, x, y, COLOR_TOLERANCE)
        }
        let patch = refineSelection(imageData, labs, extra, null, {
          labels: null,
          preserve: extra,
        })
        patch = smoothMask(patch, width, height)
        maskRef.current = unionMask(previous, patch)
        fillHoles(maskRef.current, width, height)
        paintRef.current = emptyMask(maskRef.current.length)
        bump("가구 외곽선을 따서 영역을 지정했습니다. 색상/텍스처를 입힐 수 있습니다.")
      },
      async smartFill() {
        const message = completeFromCurrentMask()
        if (message) bump(message)
      },
      async refineRegion() {
        const imageData = imageDataRef.current
        const labs = labsRef.current
        if (!imageData || !labs || !maskHasSelection(maskRef.current)) return
        let next = smoothMask(
          maskRef.current,
          imageData.width,
          imageData.height,
        )
        next = refineSelection(imageData, labs, next, null, {
          labels: null,
          preserve: paintRef.current,
        })
        next = smoothMask(next, imageData.width, imageData.height)
        maskRef.current = next
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
      unlockLivePreview() {
        setLivePreview(true)
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
      clearFinish() {
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
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
        clearSamCache()
        setFileName(file.name)
        setHasImage(true)
        setColorState(null)
        setTextureState(null)
        setAppliedColor(null)
        setAppliedTexture(null)
        setLivePreview(true)
        bump("가구를 클릭하거나 터치하면 외곽선을 따서 영역을 만듭니다.")
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

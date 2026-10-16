"use client"

import { useRef, useState } from "react"
import { Camera, ImageUp, RefreshCw, RotateCcw, Sparkles, WandSparkles } from "lucide-react"
import PreviewStage from "@/components/PreviewStage"
import { usePreview } from "@/context/PreviewContext"
import { BRUSH_RADIUS, pointerToCanvasPoint } from "@/lib/mask"

export default function FileUpload() {
  const preview = usePreview()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const drawingRef = useRef(false)
  const draggedRef = useRef(false)
  const startPointRef = useRef(null)
  const lastPointRef = useRef(null)
  const [error, setError] = useState("")

  function eventPoint(event) {
    const canvas = event.currentTarget
    const { width, height } = preview.getSize()
    if (!width || !height) return null
    return pointerToCanvasPoint(event, canvas, width, height)
  }

  function startMask(event) {
    if (!preview.hasImage) return
    event.preventDefault()
    const point = eventPoint(event)
    if (!point) return
    drawingRef.current = true
    draggedRef.current = false
    startPointRef.current = point
    lastPointRef.current = point
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveMask(event) {
    if (!drawingRef.current || !preview.hasImage) return
    event.preventDefault()
    const point = eventPoint(event)
    const start = startPointRef.current
    if (!point || !start) return
    const moved = Math.hypot(point.x - start.x, point.y - start.y)
    if (!draggedRef.current) {
      if (moved < 8) return
      draggedRef.current = true
      preview.paintBrush(null, start, BRUSH_RADIUS)
    }
    preview.paintBrush(lastPointRef.current, point, BRUSH_RADIUS)
    lastPointRef.current = point
  }

  function endMask(event) {
    if (!drawingRef.current) return
    drawingRef.current = false
    const start = startPointRef.current
    const dragged = draggedRef.current
    startPointRef.current = null
    lastPointRef.current = null
    draggedRef.current = false
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // already released
    }
    if (!dragged && start) {
      void preview.fillFromPoint(start.x, start.y)
      return
    }
    void preview.autoCompleteSelection()
  }

  async function onInputChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      setError("")
      await preview.loadFile(file)
    } catch (err) {
      setError(err.message || "사진을 불러오지 못했습니다.")
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <PreviewStage
        mode="select"
        enabled={preview.hasImage}
        onPointerDown={startMask}
        onPointerMove={moveMask}
        onPointerUp={endMask}
        emptyTitle="가구 또는 화장실 사진을 올려 주세요"
        emptyDescription="가구를 터치하거나 테두리를 칠하면 비슷한 색 안쪽이 채워지고, 경계는 부드럽게 보정됩니다."
      />

      <div className="shrink-0 space-y-2">
        {preview.hasImage ? (
          <p className="text-center text-[11px] leading-relaxed text-stone-500">
            {preview.hint ||
              "한 번 터치하면 플러드 필, 테두리를 칠하면 안쪽을 채운 뒤 선을 다듬습니다."}
          </p>
        ) : null}
        {preview.fileName ? (
          <p className="truncate text-center text-[11px] text-stone-500">
            {preview.fileName}
          </p>
        ) : null}
        {error ? (
          <p className="text-center text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 text-sm font-medium text-white active:bg-ink-800"
          >
            <Camera className="h-4 w-4" aria-hidden />
            카메라
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-ink-900 active:bg-ink-50"
          >
            {preview.hasImage ? (
              <RefreshCw className="h-4 w-4" aria-hidden />
            ) : (
              <ImageUp className="h-4 w-4" aria-hidden />
            )}
            {preview.hasImage ? "다시 선택" : "갤러리"}
          </button>
        </div>

        {preview.hasImage ? (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => preview.smartFill()}
              disabled={!preview.hasMask || preview.analyzing}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs font-medium text-sky-900 enabled:active:bg-sky-100 disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              스마트 채우기
            </button>
            <button
              type="button"
              onClick={() => preview.refineRegion()}
              disabled={!preview.hasMask || preview.analyzing}
              className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs font-medium text-sky-900 enabled:active:bg-sky-100 disabled:opacity-40"
            >
              <WandSparkles className="h-3.5 w-3.5" aria-hidden />
              경계 스무딩
            </button>
            <button
              type="button"
              onClick={() => preview.resetMask()}
              disabled={!preview.hasMask}
              className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-sky-200 bg-white text-sm font-medium text-sky-900 enabled:active:bg-sky-50 disabled:opacity-40"
            >
              <RotateCcw className="h-4 w-4" aria-hidden />
              영역 다시 지정 (Reset)
            </button>
          </div>
        ) : null}
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-source="camera"
        className="sr-only"
        onChange={onInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        data-source="gallery"
        className="sr-only"
        onChange={onInputChange}
      />
    </div>
  )
}

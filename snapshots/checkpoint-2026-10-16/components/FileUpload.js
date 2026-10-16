"use client"

import { useRef, useState } from "react"
import { Camera, ImageUp, RefreshCw, Sparkles, WandSparkles } from "lucide-react"
import PreviewStage from "@/components/PreviewStage"
import ResetAreaButton from "@/components/ResetAreaButton"
import { usePreview } from "@/context/PreviewContext"
import { pointerToWorkingPoint } from "@/lib/canvas"

export default function FileUpload() {
  const preview = usePreview()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const drawingRef = useRef(false)
  const startPointRef = useRef(null)
  const [error, setError] = useState("")

  function eventPoint(event) {
    const canvas = event.currentTarget
    preview.prepareFrame()
    const { width, height } = preview.getSize()
    if (!width || !height) return null
    return pointerToWorkingPoint(event, canvas, width, height)
  }

  function startMask(event) {
    if (!preview.hasImage || preview.analyzing) return
    event.preventDefault()
    const point = eventPoint(event)
    if (!point) return
    drawingRef.current = true
    startPointRef.current = point
    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  function moveMask(event) {
    if (!drawingRef.current || !preview.hasImage) return
    event.preventDefault()
  }

  function endMask(event) {
    if (!drawingRef.current) return
    drawingRef.current = false
    const start = startPointRef.current || eventPoint(event)
    startPointRef.current = null
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // already released
    }
    if (!start) return
    void preview.fillFromPoint(start.x, start.y)
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
    <div className="flex h-full min-h-0 flex-col gap-2">
      <PreviewStage
        mode="select"
        enabled={preview.hasImage}
        onPointerDown={startMask}
        onPointerMove={moveMask}
        onPointerUp={endMask}
        emptyTitle="가구 또는 화장실 사진을 올려 주세요"
        emptyDescription="문짝, 찬장, 테이블 등을 클릭하거나 터치하면 외곽선을 자동으로 따서 영역이 지정됩니다."
      />

      <div className="max-h-[46%] shrink-0 space-y-2 overflow-y-auto overscroll-contain scroll-touch">
        {preview.hasImage ? (
          <p className="line-clamp-2 text-center text-[11px] leading-snug text-stone-500">
            {preview.hint ||
              "가구를 한 번 터치하면 외곽선이 인식되고, 안쪽이 반투명하게 표시됩니다."}
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
            className="flex min-h-11 select-none items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 text-sm font-medium text-white active:bg-ink-800"
          >
            <Camera className="h-4 w-4" aria-hidden />
            카메라
          </button>
          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            className="flex min-h-11 select-none items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-ink-900 active:bg-ink-50"
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
              disabled={!preview.hasMask}
              className="flex min-h-11 select-none items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs font-medium text-sky-900 enabled:active:bg-sky-100 disabled:opacity-40"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              스마트 채우기
            </button>
            <button
              type="button"
              onClick={() => preview.refineRegion()}
              disabled={!preview.hasMask}
              className="flex min-h-11 select-none items-center justify-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-2 text-xs font-medium text-sky-900 enabled:active:bg-sky-100 disabled:opacity-40"
            >
              <WandSparkles className="h-3.5 w-3.5" aria-hidden />
              경계 스무딩
            </button>
            <ResetAreaButton className="col-span-2" />
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

"use client"

import { useCallback, useEffect, useRef } from "react"
import { sizeCanvasToContainer } from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import { maskToOverlay } from "@/lib/mask"
import { usePreview } from "@/context/PreviewContext"

export default function PreviewStage({
  mode = "select",
  onPointerDown,
  onPointerMove,
  onPointerUp,
  enabled = false,
  emptyTitle,
  emptyDescription,
}) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const workRef = useRef(null)
  const preview = usePreview()
  const previewRef = useRef(preview)
  previewRef.current = preview

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    const current = previewRef.current
    if (!canvas || !frame) return
    const { ctx, width, height } = sizeCanvasToContainer(canvas, frame)

    ctx.fillStyle = "#efe8dc"
    ctx.fillRect(0, 0, width, height)

    if (!current.getSource()) return

    const imageData = current.prepareFrame(width, height)
    if (!imageData) return

    const mask = current.getMask()
    const showFinish =
      mode === "finish" || Boolean(current.color || current.texture)
    const finished = showFinish
      ? applyFinish(imageData, mask, current.color, current.texture)
      : imageData

    if (!workRef.current) workRef.current = document.createElement("canvas")
    const work = workRef.current
    work.width = width
    work.height = height
    const workCtx = work.getContext("2d")
    workCtx.putImageData(finished, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.drawImage(work, 0, 0, width, height)

    if (mode === "select") {
      workCtx.clearRect(0, 0, width, height)
      workCtx.putImageData(maskToOverlay(mask, width, height), 0, 0)
      ctx.drawImage(work, 0, 0, width, height)
    }
  }, [mode])

  useEffect(() => {
    paint()
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(() => paint())
    observer.observe(frame)
    window.addEventListener("orientationchange", paint)
    return () => {
      observer.disconnect()
      window.removeEventListener("orientationchange", paint)
    }
  }, [paint, preview.version, preview.color, preview.texture, preview.hasImage])

  return (
    <div
      ref={frameRef}
      className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-stone-200 bg-ink-100"
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full ${enabled ? "cursor-crosshair touch-none" : ""}`}
        aria-label="인테리어 미리보기 캔버스"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      {!preview.hasImage && emptyTitle ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <p className="text-sm font-medium text-ink-800">{emptyTitle}</p>
          {emptyDescription ? (
            <p className="mt-1 text-xs leading-relaxed text-stone-500">
              {emptyDescription}
            </p>
          ) : null}
        </div>
      ) : null}
      {preview.analyzing ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 flex justify-center px-3">
          <p className="rounded-full bg-ink-900/80 px-3 py-1 text-[11px] font-medium text-white">
            AI가 가구와 배경을 분류하는 중...
          </p>
        </div>
      ) : null}
    </div>
  )
}

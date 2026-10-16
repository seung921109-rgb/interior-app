"use client"

import { useCallback, useEffect, useRef } from "react"
import { drawImageCover, sizeCanvasToContainer } from "@/lib/canvas"
import { createSimulationLayers, renderSimulation } from "@/lib/simulateRender"
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
  const overlayRef = useRef(null)
  const layersRef = useRef(null)
  const rafRef = useRef(0)
  const preview = usePreview()
  const previewRef = useRef(preview)
  previewRef.current = preview

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    const current = previewRef.current
    if (!canvas || !frame) return
    const { ctx, width, height, ready } = sizeCanvasToContainer(canvas, frame)

    ctx.fillStyle = "#efe8dc"
    ctx.fillRect(0, 0, width, height)

    const source = current.getSource()
    if (!source || !ready) return

    const imageData = current.prepareFrame(width, height)
    if (!imageData) {
      drawImageCover(ctx, source, width, height)
      return
    }

    if (!layersRef.current) layersRef.current = createSimulationLayers()
    if (!overlayRef.current) overlayRef.current = document.createElement("canvas")
    const mask = current.getMask()
    const simulate = mode === "finish"
    const finishColor = simulate ? current.displayColor : null
    const finishTexture = simulate ? current.displayTexture : null

    if (finishColor || finishTexture) {
      renderSimulation(ctx, layersRef.current, {
        imageData,
        mask,
        color: finishColor,
        texture: finishTexture,
        width: imageData.width,
        height: imageData.height,
        version: current.version,
        photoId: current.fileName,
        drawWidth: width,
        drawHeight: height,
      })
    } else {
      const work = overlayRef.current
      work.width = imageData.width
      work.height = imageData.height
      work.getContext("2d").putImageData(imageData, 0, 0)
      ctx.imageSmoothingEnabled = true
      ctx.drawImage(work, 0, 0, width, height)
    }

    if (mode === "select" && mask?.length === imageData.width * imageData.height) {
      const overlay = overlayRef.current
      overlay.width = imageData.width
      overlay.height = imageData.height
      overlay.getContext("2d").putImageData(
        maskToOverlay(mask, imageData.width, imageData.height),
        0,
        0,
      )
      ctx.drawImage(overlay, 0, 0, width, height)
    }
  }, [mode])

  const schedulePaint = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      paint()
    })
  }, [paint])

  useEffect(() => {
    schedulePaint()
    const frame = frameRef.current
    if (!frame || typeof ResizeObserver === "undefined") return undefined
    const observer = new ResizeObserver(() => schedulePaint())
    observer.observe(frame)
    window.addEventListener("orientationchange", schedulePaint)
    return () => {
      observer.disconnect()
      window.removeEventListener("orientationchange", schedulePaint)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = 0
      }
    }
  }, [
    schedulePaint,
    preview.version,
    preview.color,
    preview.texture,
    preview.appliedColor,
    preview.appliedTexture,
    preview.livePreview,
    preview.hasImage,
    preview.hasMask,
  ])

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

"use client"

import { useCallback, useEffect, useRef } from "react"
import { coverSourceRect, drawImageCover, sizeCanvasToContainer } from "@/lib/canvas"
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

    const imageData = current.prepareFrame()
    if (!imageData) {
      drawImageCover(ctx, source, width, height)
      return
    }

    if (!layersRef.current) layersRef.current = createSimulationLayers()
    if (!overlayRef.current) overlayRef.current = document.createElement("canvas")
    const work = overlayRef.current
    const mask = current.getMask()
    const workW = imageData.width
    const workH = imageData.height
    const crop = coverSourceRect(workW, workH, width, height)
    const simulate = mode === "finish"
    const finishColor = simulate ? current.displayColor : null
    const finishTexture = simulate ? current.displayTexture : null

    if (work.width !== workW) work.width = workW
    if (work.height !== workH) work.height = workH

    if (finishColor || finishTexture) {
      renderSimulation(work.getContext("2d"), layersRef.current, {
        imageData,
        mask,
        color: finishColor,
        texture: finishTexture,
        width: workW,
        height: workH,
        version: current.version,
        photoId: current.fileName,
      })
      drawImageCover(ctx, work, width, height)
    } else {
      work.getContext("2d").putImageData(imageData, 0, 0)
      drawImageCover(ctx, work, width, height)
    }

    if (mode === "select" && mask?.length === workW * workH) {
      if (work.width !== workW) work.width = workW
      if (work.height !== workH) work.height = workH
      work.getContext("2d").putImageData(
        maskToOverlay(mask, workW, workH),
        0,
        0,
      )
      ctx.drawImage(work, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
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
    window.visualViewport?.addEventListener("resize", schedulePaint)
    return () => {
      observer.disconnect()
      window.removeEventListener("orientationchange", schedulePaint)
      window.visualViewport?.removeEventListener("resize", schedulePaint)
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
      className="relative min-h-[140px] flex-1 overflow-hidden rounded-xl border border-stone-200 bg-ink-100"
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full select-none ${enabled ? "cursor-crosshair touch-none" : ""}`}
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
      {mode === "select" &&
      preview.hasImage &&
      preview.hasMask &&
      !preview.analyzing ? (
        <div className="pointer-events-none absolute inset-x-0 top-2 z-[5] flex justify-center px-3">
          <p className="rounded-full bg-ink-900/80 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-white">
            빈공간이 있다면 터치하여 추가 영역 선택
          </p>
        </div>
      ) : null}
      {preview.analyzing ? (
        <div
          className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-ink-900/40"
          aria-live="polite"
          aria-busy="true"
        >
          <div
            className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
            aria-hidden
          />
          <p className="mt-3 text-sm font-medium tracking-tight text-white">
            영역 추출중
          </p>
        </div>
      ) : null}
    </div>
  )
}

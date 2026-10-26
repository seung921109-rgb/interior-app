"use client"

import { useCallback, useEffect, useRef } from "react"
import {
  clampImageView,
  containDestRect,
  coverSourceRect,
  drawImageCover,
  pointerToCanvasPixels,
  sizeCanvasToContainer,
  sourceSize,
  viewDestRect,
} from "@/lib/canvas"
import { createSimulationLayers, renderSimulation } from "@/lib/simulateRender"
import { maskToOverlay } from "@/lib/mask"
import { regionsToOverlay } from "@/lib/regions"
import { usePreview } from "@/context/PreviewContext"

export default function PreviewStage({
  mode = "select",
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  enabled = false,
  emptyTitle,
  emptyDescription,
  banner,
  children,
  fit = "cover",
  bleed = false,
  drawTool = "tap",
}) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const overlayRef = useRef(null)
  const layersRef = useRef(null)
  const rafRef = useRef(0)
  const paintGenRef = useRef(0)
  const pointersRef = useRef(new Map())
  const pinchRef = useRef(null)
  const dragRef = useRef(null)
  const gestureRef = useRef("")
  const preview = usePreview()
  const previewRef = useRef(preview)
  const drawToolRef = useRef(drawTool)
  previewRef.current = preview
  drawToolRef.current = drawTool

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    const current = previewRef.current
    if (!canvas || !frame) return
    const { ctx, width, height, ready } = sizeCanvasToContainer(canvas, frame)

    ctx.fillStyle = fit === "contain" ? "#11110f" : "#efe8dc"
    ctx.fillRect(0, 0, width, height)

    const source = current.getSource()
    if (!source || !ready) return

    const imageData = current.prepareFrame()
    const view = current.imageView || { scale: 1, u: 0.5, v: 0.5 }
    const showOriginal = Boolean(current.peekOriginal)
    if (!imageData) {
      if (fit === "contain") {
        const { width: sourceWidth, height: sourceHeight } = sourceSize(source)
        const placed = viewDestRect(sourceWidth, sourceHeight, width, height, view)
        ctx.drawImage(source, 0, 0, sourceWidth, sourceHeight, placed.dx, placed.dy, placed.dw, placed.dh)
      } else {
        drawImageCover(ctx, source, width, height)
      }
      return
    }

    if (!layersRef.current) layersRef.current = createSimulationLayers()
    if (!overlayRef.current) overlayRef.current = document.createElement("canvas")
    const work = overlayRef.current
    const mask = current.getMask()
    const finishJobs =
      typeof current.getFinishJobs === "function" ? current.getFinishJobs() : []
    const workW = imageData.width
    const workH = imageData.height
    const crop = coverSourceRect(workW, workH, width, height)
    const dest =
      fit === "contain" ? viewDestRect(workW, workH, width, height, view) : null
    const simulate = mode === "finish" && !showOriginal
    const finishColor = simulate ? current.displayColor : null
    const finishTexture = simulate ? current.displayTexture : null

    if (work.width !== workW) work.width = workW
    if (work.height !== workH) work.height = workH

    const blit = () => {
      if (fit === "contain") {
        ctx.drawImage(work, 0, 0, workW, workH, dest.dx, dest.dy, dest.dw, dest.dh)
      } else {
        ctx.drawImage(work, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, width, height)
      }
    }

    if (simulate && (finishJobs.length || finishColor || finishTexture)) {
      renderSimulation(work.getContext("2d"), layersRef.current, {
        imageData,
        mask,
        color: finishColor,
        texture: finishTexture,
        targets: finishJobs,
        width: workW,
        height: workH,
        version: current.version,
        photoId: current.fileName,
      })
      blit()
    } else {
      work.getContext("2d").putImageData(imageData, 0, 0)
      blit()
    }

    if (!showOriginal && mode === "select") {
      const regions = current.regions
      const painted = ["region1", "region2", "region3"].some(
        (id) => regions?.[id]?.hasMask && regions[id].mask,
      )
      if (painted) {
        work.getContext("2d").putImageData(
          regionsToOverlay(regions, workW, workH, current.activeTargetId),
          0,
          0,
        )
        blit()
      } else if (mask?.length === workW * workH && mask.some((value) => value > 8)) {
        work.getContext("2d").putImageData(maskToOverlay(mask, workW, workH), 0, 0)
        blit()
      }
    }
  }, [fit, mode])

  const schedulePaint = useCallback(() => {
    const gen = paintGenRef.current + 1
    paintGenRef.current = gen
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0
      if (gen !== paintGenRef.current) return
      paint()
    })
  }, [paint])

  const bitmapPoint = useCallback((event) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    return pointerToCanvasPixels(event, canvas)
  }, [])

  const focusView = useCallback((focal, nextScale) => {
    const canvas = canvasRef.current
    const current = previewRef.current
    const { width: workW, height: workH } = current.getSize()
    if (!canvas || !workW || !workH) return
    const prev = current.imageView || { scale: 1, u: 0.5, v: 0.5 }
    const placed = viewDestRect(workW, workH, canvas.width, canvas.height, prev)
    const imageU = (focal.x - placed.dx) / placed.dw
    const imageV = (focal.y - placed.dy) / placed.dh
    const base = containDestRect(workW, workH, canvas.width, canvas.height)
    const scale = Math.min(6, Math.max(1, nextScale))
    const dw = base.dw * scale
    const dh = base.dh * scale
    const panX = focal.x - imageU * dw
    const panY = focal.y - imageV * dh
    current.setImageView(
      clampImageView(
        {
          scale,
          u: (canvas.width / 2 - panX) / dw,
          v: (canvas.height / 2 - panY) / dh,
        },
        workW,
        workH,
        canvas.width,
        canvas.height,
      ),
    )
  }, [])

  function handlePointerDown(event) {
    if (!previewRef.current.hasImage) {
      onPointerDown?.(event)
      return
    }
    pointersRef.current.set(event.pointerId, bitmapPoint(event))
    try {
      event.currentTarget?.setPointerCapture?.(event.pointerId)
    } catch {
      // pointer already released
    }
    if (pointersRef.current.size >= 2) {
      const points = [...pointersRef.current.values()]
      gestureRef.current = "pinch"
      pinchRef.current = {
        dist: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1,
        scale: previewRef.current.imageView?.scale || 1,
      }
      dragRef.current = null
      return
    }
    const origin = bitmapPoint(event)
    dragRef.current = { id: event.pointerId, ...origin, lastX: origin.x, lastY: origin.y, moved: false }
    if (drawToolRef.current === "erase") onPointerDown?.(event)
  }

  function handlePointerMove(event) {
    if (!pointersRef.current.has(event.pointerId)) {
      onPointerMove?.(event)
      return
    }
    pointersRef.current.set(event.pointerId, bitmapPoint(event))
    if (pointersRef.current.size >= 2 && pinchRef.current) {
      const points = [...pointersRef.current.values()]
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) || 1
      const mid = {
        x: (points[0].x + points[1].x) / 2,
        y: (points[0].y + points[1].y) / 2,
      }
      focusView(mid, pinchRef.current.scale * (dist / pinchRef.current.dist))
      return
    }
    const drag = dragRef.current
    if (drag && event.pointerId === drag.id && drawToolRef.current !== "erase") {
      const point = bitmapPoint(event)
      const canvas = canvasRef.current
      const rect = canvas?.getBoundingClientRect()
      const unit = rect?.width ? canvas.width / rect.width : 1
      const travel = Math.hypot(point.x - drag.x, point.y - drag.y)
      const scale = previewRef.current.imageView?.scale || 1
      if (!drag.moved && travel > 18 * unit && scale > 1) drag.moved = true
      if (drag.moved) {
        const canvas = canvasRef.current
        const { width: workW, height: workH } = previewRef.current.getSize()
        const view = previewRef.current.imageView || { scale: 1, u: 0.5, v: 0.5 }
        const base = containDestRect(workW, workH, canvas.width, canvas.height)
        const dx = point.x - drag.lastX
        const dy = point.y - drag.lastY
        drag.lastX = point.x
        drag.lastY = point.y
        previewRef.current.setImageView(
          clampImageView(
            {
              scale: view.scale,
              u: view.u - dx / (base.dw * view.scale),
              v: view.v - dy / (base.dh * view.scale),
            },
            workW,
            workH,
            canvas.width,
            canvas.height,
          ),
        )
        return
      }
    }
    if (drawToolRef.current === "erase") onPointerMove?.(event)
  }

  function handlePointerUp(event) {
    pointersRef.current.delete(event.pointerId)
    if (gestureRef.current === "pinch") {
      if (pointersRef.current.size < 2) pinchRef.current = null
      if (pointersRef.current.size === 0) gestureRef.current = ""
      return
    }
    const dragged = Boolean(dragRef.current?.moved)
    dragRef.current = null
    if (dragged) return
    if (drawToolRef.current === "erase") {
      onPointerUp?.(event)
      return
    }
    if (!previewRef.current.hasImage) {
      onPointerUp?.(event)
      return
    }
    onPointerDown?.(event)
    onPointerUp?.(event)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !preview.hasImage) return undefined
    const preventScroll = (event) => {
      event.preventDefault()
    }
    const onWheel = (event) => {
      event.preventDefault()
      const focal = pointerToCanvasPixels(event, canvas)
      const scale = previewRef.current.imageView?.scale || 1
      const next = scale * Math.exp(-event.deltaY * 0.0016)
      focusView(focal, next)
    }
    canvas.addEventListener("touchstart", preventScroll, { passive: false })
    canvas.addEventListener("touchmove", preventScroll, { passive: false })
    canvas.addEventListener("wheel", onWheel, { passive: false })
    return () => {
      canvas.removeEventListener("touchstart", preventScroll)
      canvas.removeEventListener("touchmove", preventScroll)
      canvas.removeEventListener("wheel", onWheel)
    }
  }, [focusView, preview.hasImage])

  useEffect(() => {
    layersRef.current = null
    overlayRef.current = null
  }, [preview.fileName])

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
    preview.imageView,
    preview.peekOriginal,
  ])

  return (
    <div
      ref={frameRef}
      className={
        bleed
          ? "relative min-h-0 flex-1 overflow-hidden bg-ink-900"
          : "relative min-h-[140px] flex-1 overflow-hidden rounded-xl border border-stone-200 bg-ink-100"
      }
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full select-none ${enabled ? "cursor-crosshair touch-none" : ""}`}
        style={{ touchAction: preview.hasImage ? "none" : undefined }}
        aria-label="인테리어 미리보기 캔버스"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
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
      {(mode === "select" || (mode === "finish" && banner)) &&
      preview.hasImage &&
      !preview.analyzing &&
      !preview.peekOriginal &&
      (banner || preview.hasMask) ? (
        <div
          className={`pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[5] flex justify-center px-3 ${
            mode === "finish" ? "pr-24" : ""
          }`}
        >
          <p className="rounded-full bg-ink-900/80 px-3 py-1.5 text-center text-[11px] font-medium leading-snug text-white">
            {banner || "빈공간이 있다면 터치하여 추가 영역 선택"}
          </p>
        </div>
      ) : null}
      {children}
    </div>
  )
}

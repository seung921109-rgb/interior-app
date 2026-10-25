"use client"

import { useEffect, useRef } from "react"
import { eventClientXY } from "@/lib/canvas"

export const MAGNIFIER_SIZE = 128
const ZOOM = 2.45

function loupePosition(localX, localY, frameW, frameH) {
  const size = MAGNIFIER_SIZE
  let left = localX - size / 2
  let top = localY - size - 36
  if (top < 8) top = localY + 40
  if (left < 8) left = 8
  if (left + size > frameW - 8) left = Math.max(8, frameW - size - 8)
  if (top + size > frameH - 8) top = Math.max(8, frameH - size - 8)
  return { left, top }
}

function paintLoupe(loupeCanvas, sourceCanvas, canvasX, canvasY) {
  if (!loupeCanvas || !sourceCanvas) return
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const css = MAGNIFIER_SIZE
  const pixel = Math.round(css * dpr)
  if (loupeCanvas.width !== pixel) loupeCanvas.width = pixel
  if (loupeCanvas.height !== pixel) loupeCanvas.height = pixel
  const ctx = loupeCanvas.getContext("2d")
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.clearRect(0, 0, pixel, pixel)
  ctx.save()
  ctx.beginPath()
  ctx.arc(pixel / 2, pixel / 2, pixel / 2 - 1, 0, Math.PI * 2)
  ctx.clip()
  const srcW = sourceCanvas.width
  const cssW = sourceCanvas.getBoundingClientRect().width || srcW
  const sample = ((css / ZOOM) * srcW) / Math.max(1, cssW)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(
    sourceCanvas,
    canvasX - sample / 2,
    canvasY - sample / 2,
    sample,
    sample,
    0,
    0,
    pixel,
    pixel,
  )
  ctx.restore()
}

export default function TouchMagnifier({
  visible,
  localX,
  localY,
  canvasX,
  canvasY,
  sourceCanvas,
}) {
  const canvasRef = useRef(null)
  const wrapRef = useRef(null)

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    if (!visible || !sourceCanvas) {
      wrap.style.opacity = "0"
      return
    }
    const frame = wrap.parentElement
    const { left, top } = loupePosition(
      localX,
      localY,
      frame?.clientWidth || 0,
      frame?.clientHeight || 0,
    )
    wrap.style.transform = `translate(${left}px, ${top}px)`
    wrap.style.opacity = "1"
    paintLoupe(canvasRef.current, sourceCanvas, canvasX, canvasY)
  }, [visible, localX, localY, canvasX, canvasY, sourceCanvas])

  return (
    <div
      ref={wrapRef}
      className="pointer-events-none absolute left-0 top-0 z-[7] opacity-0"
      style={{ width: MAGNIFIER_SIZE, height: MAGNIFIER_SIZE }}
      aria-hidden
    >
      <canvas ref={canvasRef} className="h-full w-full rounded-full bg-ink-100" />
      <div className="absolute inset-0 rounded-full border-2 border-white shadow-[0_8px_24px_rgba(28,24,20,0.35)]" />
      <div className="absolute left-1/2 top-[18%] h-[64%] w-px -translate-x-1/2 bg-sky-400/90" />
      <div className="absolute left-[18%] top-1/2 h-px w-[64%] -translate-y-1/2 bg-sky-400/90" />
      <div className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-300 ring-1 ring-ink-900/40" />
    </div>
  )
}

export function magnifierLocalPoint(event, frame) {
  if (!frame) return null
  const { clientX, clientY } = eventClientXY(event)
  const rect = frame.getBoundingClientRect()
  return {
    x: clientX - rect.left,
    y: clientY - rect.top,
  }
}

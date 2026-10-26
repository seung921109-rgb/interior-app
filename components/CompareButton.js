"use client"

import { usePreview } from "@/context/PreviewContext"

export default function CompareButton({ className = "" }) {
  const preview = usePreview()
  const showingOriginal = Boolean(preview.peekOriginal)

  function showOriginal(event) {
    event.preventDefault()
    try {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // pointer already released
    }
    preview.setPeekOriginal(true)
  }

  function showResult() {
    preview.setPeekOriginal(false)
  }

  return (
    <button
      type="button"
      aria-pressed={showingOriginal}
      onPointerDown={showOriginal}
      onPointerUp={showResult}
      onPointerCancel={showResult}
      className={`flex min-h-10 select-none items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${
        className || "bg-white/10 text-white"
      }`}
    >
      <span className={showingOriginal ? "text-white" : "text-white/45"}>Before</span>
      <span className="text-white/30" aria-hidden>
        /
      </span>
      <span className={showingOriginal ? "text-white/45" : "text-white"}>After</span>
    </button>
  )
}

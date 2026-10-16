"use client"

import { RotateCcw } from "lucide-react"
import { usePreview } from "@/context/PreviewContext"

export default function ResetAreaButton({ className = "" }) {
  const preview = usePreview()
  const canReset = preview.hasMask || preview.color || preview.texture

  return (
    <button
      type="button"
      onClick={() => preview.resetArea()}
      disabled={!canReset}
      className={`flex min-h-12 items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-medium text-ink-900 enabled:active:bg-ink-50 disabled:opacity-40 ${className}`}
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      영역 초기화 (Reset)
    </button>
  )
}

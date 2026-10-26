"use client"

import { RotateCcw } from "lucide-react"
import { usePreview } from "@/context/PreviewContext"

export default function ResetAreaButton({
  className = "",
  label = "영역 초기화 (Reset)",
  scope = "area",
}) {
  const preview = usePreview()
  const active =
    (preview.targets || []).find((item) => item.id === preview.activeTargetId) ||
    (preview.targets || [])[0]
  const canReset =
    scope === "finish"
      ? Boolean(
          active?.color ||
            active?.texture ||
            active?.appliedColor ||
            active?.appliedTexture ||
            preview.color ||
            preview.texture ||
            preview.appliedColor ||
            preview.appliedTexture,
        )
      : preview.hasMask || preview.color || preview.texture

  return (
    <button
      type="button"
      onClick={() => (scope === "finish" ? preview.resetStyle() : preview.resetArea())}
      disabled={!canReset}
      className={`flex min-h-11 select-none items-center justify-center gap-2 rounded-xl border text-sm font-medium disabled:opacity-40 ${
        className ||
        "border-stone-300 bg-white text-ink-900 enabled:active:bg-ink-50"
      }`}
    >
      <RotateCcw className="h-4 w-4" aria-hidden />
      {label}
    </button>
  )
}

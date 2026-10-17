"use client"

import { Image } from "lucide-react"
import { usePreview } from "@/context/PreviewContext"

export default function RestoreOriginalButton({ className = "" }) {
  const preview = usePreview()
  const canRestore = Boolean(
    preview.color ||
      preview.texture ||
      preview.appliedColor ||
      preview.appliedTexture,
  )

  return (
    <button
      type="button"
      onClick={() => preview.clearFinish()}
      disabled={!canRestore}
      className={`flex min-h-11 w-full select-none items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white text-sm font-medium text-ink-900 enabled:active:bg-ink-50 disabled:opacity-40 ${className}`}
    >
      <Image className="h-4 w-4" aria-hidden />
      원본 이미지로 되돌리기
    </button>
  )
}

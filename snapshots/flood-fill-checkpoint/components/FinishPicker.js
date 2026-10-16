"use client"

import { TEXTURES } from "@/lib/textures"
import { usePreview } from "@/context/PreviewContext"

export const PAINTS = [
  { hex: "#F5F2EA", label: "웜 화이트" },
  { hex: "#C4A574", label: "오크 우드" },
  { hex: "#C46A4A", label: "테라코타" },
  { hex: "#8A9A7B", label: "세이지" },
  { hex: "#9A9A94", label: "콘크리트" },
  { hex: "#3A3A3A", label: "매트 블랙" },
]

export default function FinishPicker() {
  const preview = usePreview()
  const disabled = !preview.hasMask

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-medium text-stone-500">컬러</p>
        <div className="grid grid-cols-3 gap-2">
          {PAINTS.map((paint) => {
            const active = preview.color === paint.hex
            return (
              <button
                key={paint.hex}
                type="button"
                disabled={disabled}
                onClick={() =>
                  preview.setColor(active ? null : paint.hex)
                }
                className={`flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-xl border px-2 text-xs font-medium disabled:opacity-40 ${
                  active
                    ? "border-clay-500 ring-2 ring-clay-500/30"
                    : "border-stone-200 bg-ink-50 text-ink-800"
                }`}
              >
                <span
                  className="h-6 w-6 rounded-full border border-black/10"
                  style={{ background: paint.hex }}
                />
                {paint.label}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-stone-500">텍스처</p>
        <div className="grid grid-cols-3 gap-2">
          {TEXTURES.map((item) => {
            const active = preview.texture === item.id
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() =>
                  preview.setTexture(active ? null : item.id)
                }
                className={`flex min-h-[64px] items-center justify-center rounded-xl border px-2 text-xs font-medium disabled:opacity-40 ${
                  active
                    ? "border-clay-500 bg-ink-50 text-ink-900 ring-2 ring-clay-500/30"
                    : "border-stone-200 bg-white text-ink-800"
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

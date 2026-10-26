"use client"

import { REGION_IDS, REGION_TINTS, regionLabel } from "@/lib/regions"
import { usePreview } from "@/context/PreviewContext"

export default function RegionBar() {
  const preview = usePreview()

  return (
    <div className="grid grid-cols-3 gap-1.5" role="tablist" aria-label="영역">
      {REGION_IDS.map((id, index) => {
        const region = preview.regions?.[id]
        const active = preview.activeTarget === index + 1
        const swatch = region?.color || region?.appliedColor
        const tint = REGION_TINTS[index]
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => preview.setActiveTarget(index + 1)}
            className={`flex min-h-9 items-center justify-center gap-1.5 rounded-xl text-[11px] font-medium ${
              active
                ? "bg-white text-ink-900"
                : "bg-white/10 text-white/80 active:bg-white/16"
            }`}
          >
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
              style={{
                background: swatch || `rgb(${tint[0]}, ${tint[1]}, ${tint[2]})`,
              }}
              aria-hidden
            />
            {regionLabel(index)}
          </button>
        )
      })}
    </div>
  )
}

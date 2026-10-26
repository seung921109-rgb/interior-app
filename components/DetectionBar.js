"use client"

import { usePreview } from "@/context/PreviewContext"

export default function DetectionBar() {
  const preview = usePreview()
  const items = preview.detections || []
  if (!items.length) return null

  return (
    <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="list" aria-label="탐지된 사물">
      {items.map((item) => {
        const assigned = (preview.targets || []).find((target) => target.detection?.id === item.id)
        const active = assigned?.id === preview.activeTargetId
        return (
          <div
            key={item.id}
            role="listitem"
            className={`flex min-h-8 shrink-0 items-center gap-1 rounded-full pl-2.5 pr-1 text-[10px] font-medium ${
              active ? "bg-white text-ink-900" : "bg-white/10 text-white/85"
            }`}
          >
            <button
              type="button"
              onClick={() => preview.assignDetection(item.id)}
              className="flex min-h-8 items-center gap-1"
            >
              {item.label}
              {item.detail && item.detail !== item.label ? (
                <span className={active ? "text-ink-500" : "text-white/55"}>{item.detail}</span>
              ) : null}
              {item.confidence ? (
                <span className={active ? "text-ink-500" : "text-white/55"}>
                  {Math.round(item.confidence * 100)}%
                </span>
              ) : null}
            </button>
            <button
              type="button"
              aria-label={`${item.label} 후보 빼기`}
              onClick={() => preview.dismissDetection(item.id)}
              className={`inline-flex h-5 w-5 items-center justify-center rounded-full ${
                active ? "text-ink-500" : "text-white/55"
              }`}
            >
              ×
            </button>
          </div>
        )
      })}
    </div>
  )
}

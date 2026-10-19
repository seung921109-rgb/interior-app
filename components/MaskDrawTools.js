"use client"

import { Eraser, MousePointerClick, Paintbrush } from "lucide-react"

const SIZES = [
  { id: "s", label: "가늘게", radius: 3.5 },
  { id: "m", label: "보통", radius: 6.5 },
  { id: "l", label: "굵게", radius: 11 },
]

export default function MaskDrawTools({ tool, onTool, sizeId, onSize, dock = false }) {
  return (
    <div
      className={
        dock
          ? "flex flex-col gap-1.5"
          : "pointer-events-auto absolute inset-x-2 bottom-2 z-[6] flex flex-col gap-1.5"
      }
    >
      <div className="flex rounded-2xl border border-white/20 bg-ink-900/82 p-1 shadow-lg backdrop-blur-sm">
        <button
          type="button"
          aria-pressed={tool === "tap"}
          onClick={() => onTool("tap")}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${
            tool === "tap" ? "bg-white text-ink-900" : "text-white/85"
          }`}
        >
          <MousePointerClick className="h-3.5 w-3.5" aria-hidden />
          터치
        </button>
        <button
          type="button"
          aria-pressed={tool === "brush"}
          onClick={() => onTool("brush")}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${
            tool === "brush" ? "bg-white text-ink-900" : "text-white/85"
          }`}
        >
          <Paintbrush className="h-3.5 w-3.5" aria-hidden />
          브러시
        </button>
        <button
          type="button"
          aria-pressed={tool === "erase"}
          onClick={() => onTool("erase")}
          className={`flex min-h-10 flex-1 items-center justify-center gap-1 rounded-xl text-[11px] font-medium ${
            tool === "erase" ? "bg-white text-ink-900" : "text-white/85"
          }`}
        >
          <Eraser className="h-3.5 w-3.5" aria-hidden />
          지우개
        </button>
      </div>
      {tool !== "tap" ? (
        <div className="mx-auto flex rounded-full bg-white/92 p-0.5 shadow">
          {SIZES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={sizeId === item.id}
              onClick={() => onSize(item.id)}
              className={`min-h-8 rounded-full px-3 text-[11px] font-medium ${
                sizeId === item.id ? "bg-ink-900 text-white" : "text-ink-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function brushRadiusForSize(sizeId) {
  return SIZES.find((item) => item.id === sizeId)?.radius || 3.5
}

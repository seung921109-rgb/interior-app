"use client"

import { useEffect, useState } from "react"
import SwatchScroller from "@/components/SwatchScroller"
import { TEXTURES, getTexture } from "@/lib/textures"
import { usePreview } from "@/context/PreviewContext"

export const PAINTS = [
  { hex: "#F7F4EE", label: "화이트" },
  { hex: "#F5F2EA", label: "웜 화이트" },
  { hex: "#E8D9C4", label: "아이보리" },
  { hex: "#D9C4A8", label: "샌드" },
  { hex: "#C4A574", label: "오크 베이지" },
  { hex: "#C46A4A", label: "테라코타" },
  { hex: "#C9897A", label: "더스티 로즈" },
  { hex: "#8A9A7B", label: "세이지" },
  { hex: "#6E8B74", label: "올리브" },
  { hex: "#7E93A8", label: "슬레이트 블루" },
  { hex: "#9A9A94", label: "콘크리트" },
  { hex: "#6B6560", label: "차콜" },
  { hex: "#3A3A3A", label: "매트 블랙" },
  { hex: "#243044", label: "네이비" },
]

function TextureSample({ id }) {
  const [url, setUrl] = useState("")

  useEffect(() => {
    const texture = getTexture(id)
    const canvas = document.createElement("canvas")
    canvas.width = texture.width
    canvas.height = texture.height
    canvas.getContext("2d").putImageData(texture, 0, 0)
    setUrl(canvas.toDataURL("image/png"))
  }, [id])

  return (
    <span
      aria-hidden
      className="block h-full w-full bg-cover bg-center"
      style={url ? { backgroundImage: `url(${url})` } : { background: "#d7cfc4" }}
    />
  )
}

export default function FinishPicker() {
  const preview = usePreview()
  const disabled = !preview.hasMask
  const currentFilm = TEXTURES.find((item) => item.id === preview.texture)

  return (
    <div className="space-y-4">
      <SwatchScroller label="단색 페인트">
        {PAINTS.map((paint) => {
          const active = preview.color === paint.hex
          return (
            <button
              key={paint.hex}
              type="button"
              role="listitem"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => preview.setColor(paint.hex)}
              className={`w-[4.5rem] shrink-0 snap-start rounded-2xl border p-2 text-center disabled:opacity-40 ${
                active
                  ? "border-clay-500 bg-ink-50 ring-2 ring-clay-500/30"
                  : "border-stone-200 bg-white"
              }`}
            >
              <span
                className="mx-auto block h-12 w-12 rounded-full border border-black/10 shadow-inner"
                style={{ background: paint.hex }}
              />
              <span className="mt-1.5 block truncate text-[11px] font-medium text-ink-800">
                {paint.label}
              </span>
            </button>
          )
        })}
      </SwatchScroller>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2 px-0.5">
          <p className="text-[11px] text-stone-500">
            {currentFilm
              ? `현재 필름: ${currentFilm.label} · 다른 샘플을 누르면 바로 교체됩니다.`
              : "필름 샘플을 누르면 마스크 안쪽에 바로 적용됩니다."}
          </p>
          {currentFilm ? (
            <button
              type="button"
              disabled={disabled}
              onClick={() => preview.setTexture(null)}
              className="shrink-0 text-[11px] font-medium text-clay-600 disabled:opacity-40"
            >
              필름 해제
            </button>
          ) : null}
        </div>
      <SwatchScroller label="인테리어 필름지">
        {TEXTURES.map((item) => {
          const active = preview.texture === item.id
          return (
            <button
              key={item.id}
              type="button"
              role="listitem"
              disabled={disabled}
              aria-pressed={active}
              onClick={() => preview.setTexture(item.id)}
              className={`w-[6.75rem] shrink-0 snap-start overflow-hidden rounded-2xl border text-left disabled:opacity-70 ${
                active
                  ? "border-clay-500 ring-2 ring-clay-500/30"
                  : "border-stone-200"
              }`}
            >
              <span className="block h-16 overflow-hidden bg-ink-100">
                <TextureSample id={item.id} />
              </span>
              <span className="block bg-white px-2 py-1.5">
                <span className="block truncate text-[10px] text-stone-500">
                  {item.group}
                </span>
                <span className="block truncate text-[11px] font-medium text-ink-800">
                  {item.label}
                </span>
              </span>
            </button>
          )
        })}
      </SwatchScroller>
      </div>
    </div>
  )
}

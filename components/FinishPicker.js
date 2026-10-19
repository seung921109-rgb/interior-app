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

function FinishRail() {
  const preview = usePreview()
  const disabled = !preview.hasMask
  const [kind, setKind] = useState(preview.texture ? "film" : "paint")
  const currentFilm = TEXTURES.find((item) => item.id === preview.texture)

  return (
    <div className="flex h-full min-h-0 w-[4.75rem] flex-col gap-1.5">
      <div className="grid shrink-0 grid-cols-2 gap-0.5 rounded-xl bg-black/35 p-0.5">
        <button
          type="button"
          aria-pressed={kind === "paint"}
          onClick={() => setKind("paint")}
          className={`min-h-8 rounded-lg text-[10px] font-medium ${
            kind === "paint" ? "bg-white text-ink-900" : "text-white/80"
          }`}
        >
          색상
        </button>
        <button
          type="button"
          aria-pressed={kind === "film"}
          onClick={() => setKind("film")}
          className={`min-h-8 rounded-lg text-[10px] font-medium ${
            kind === "film" ? "bg-white text-ink-900" : "text-white/80"
          }`}
        >
          필름
        </button>
      </div>
      <div
        className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {kind === "paint"
          ? PAINTS.map((paint) => {
              const active = preview.color === paint.hex
              return (
                <button
                  key={paint.hex}
                  type="button"
                  role="listitem"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => preview.setColor(paint.hex)}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl p-1 disabled:opacity-40 ${
                    active ? "bg-white ring-2 ring-clay-400" : "bg-black/25"
                  }`}
                >
                  <span
                    className="block h-9 w-9 rounded-full border border-white/25 shadow-inner"
                    style={{ background: paint.hex }}
                  />
                  <span
                    className={`block w-full truncate text-[9px] font-medium ${
                      active ? "text-ink-900" : "text-white/85"
                    }`}
                  >
                    {paint.label}
                  </span>
                </button>
              )
            })
          : TEXTURES.map((item) => {
              const active = preview.texture === item.id
              return (
                <button
                  key={item.id}
                  type="button"
                  role="listitem"
                  disabled={disabled}
                  aria-pressed={active}
                  onClick={() => preview.setTexture(item.id)}
                  className={`overflow-hidden rounded-xl text-left disabled:opacity-50 ${
                    active ? "ring-2 ring-clay-400" : "ring-1 ring-white/15"
                  }`}
                >
                  <span className="block h-11 overflow-hidden bg-ink-100">
                    <TextureSample id={item.id} />
                  </span>
                  <span
                    className={`block truncate px-1 py-1 text-center text-[9px] font-medium ${
                      active ? "bg-white text-ink-900" : "bg-black/45 text-white/85"
                    }`}
                  >
                    {item.label}
                  </span>
                </button>
              )
            })}
      </div>
      {kind === "film" && currentFilm ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => preview.setTexture(null)}
          className="shrink-0 rounded-lg bg-white/12 py-1.5 text-[10px] font-medium text-white disabled:opacity-40"
        >
          필름 해제
        </button>
      ) : null}
    </div>
  )
}

export default function FinishPicker({ layout = "board" }) {
  const preview = usePreview()
  const disabled = !preview.hasMask
  const currentFilm = TEXTURES.find((item) => item.id === preview.texture)

  if (layout === "rail") return <FinishRail />

  return (
    <div className="space-y-3">
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
              className={`w-16 shrink-0 snap-start select-none rounded-2xl border p-1.5 text-center disabled:opacity-40 sm:w-[4.5rem] sm:p-2 ${
                active
                  ? "border-clay-500 bg-ink-50 ring-2 ring-clay-500/30"
                  : "border-stone-200 bg-white"
              }`}
            >
              <span
                className="mx-auto block h-10 w-10 rounded-full border border-black/10 shadow-inner sm:h-12 sm:w-12"
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
                className={`w-[6.25rem] shrink-0 snap-start select-none overflow-hidden rounded-2xl border text-left disabled:opacity-70 sm:w-[6.75rem] ${
                  active
                    ? "border-clay-500 ring-2 ring-clay-500/30"
                    : "border-stone-200"
                }`}
              >
                <span className="block h-12 overflow-hidden bg-ink-100 sm:h-16">
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

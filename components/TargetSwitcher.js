"use client"

export default function TargetSwitcher({
  targets = [],
  activeTargetId,
  onSelect,
  tone = "light",
}) {
  if (!targets.length) return null

  return (
    <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="적용 대상">
      {targets.map((item) => {
        const active = item.id === activeTargetId
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.id)}
            className={`rounded-full px-3 py-1 text-[11px] font-medium ${
              tone === "dark"
                ? active
                  ? "bg-white text-ink-900"
                  : "bg-white/12 text-white/85 active:bg-white/20"
                : active
                  ? "bg-ink-900 text-white"
                  : "bg-ink-100 text-ink-800 active:bg-ink-200"
            }`}
          >
            {item.label}
            {item.hasMask ? "" : " · 영역 없음"}
          </button>
        )
      })}
    </div>
  )
}

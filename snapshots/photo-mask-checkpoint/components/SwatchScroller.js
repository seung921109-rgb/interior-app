"use client"

export default function SwatchScroller({ label, children }) {
  return (
    <section className="min-w-0">
      <h3 className="mb-2 px-0.5 text-xs font-medium text-stone-500">{label}</h3>
      <div
        className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="list"
      >
        {children}
      </div>
    </section>
  )
}

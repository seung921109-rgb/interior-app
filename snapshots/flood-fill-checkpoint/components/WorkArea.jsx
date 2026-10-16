export default function WorkArea({ title, description, children }) {
  return (
    <section className="flex h-full min-h-0 flex-col px-4 py-4">
      <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-black/10 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <p className="text-xs font-medium uppercase tracking-wide text-clay-600">
            작업 영역
          </p>
          <h2 className="mt-1 text-lg font-semibold text-ink-900">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-stone-500">
            {description}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {children}
        </div>
      </div>
    </section>
  )
}

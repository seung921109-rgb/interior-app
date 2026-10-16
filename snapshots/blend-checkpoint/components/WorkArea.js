export default function WorkArea({ title, description, children, fill = false }) {
  return (
    <section className="flex h-full min-h-0 flex-col bg-ink-50">
      <div className="shrink-0 px-4 pb-2 pt-3">
        <h2 className="text-base font-semibold text-ink-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs leading-relaxed text-stone-500">
            {description}
          </p>
        ) : null}
      </div>
      <div
        className={
          fill
            ? "flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-4"
            : "min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4"
        }
      >
        {children}
      </div>
    </section>
  )
}

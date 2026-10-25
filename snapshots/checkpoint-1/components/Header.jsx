export default function Header() {
  return (
    <header className="shrink-0 border-b border-black/10 bg-ink-900 text-ink-50 pt-[env(safe-area-inset-top)]">
      <div className="flex min-h-14 items-center justify-center px-4 py-3">
        <h1 className="text-center text-[15px] font-semibold leading-snug tracking-tight sm:text-base">
          집고치기 AI - 가구/타일 시뮬레이터
        </h1>
      </div>
    </header>
  )
}

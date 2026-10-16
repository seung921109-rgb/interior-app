import AuthStatus from "@/components/AuthStatus"

export default function Header() {
  return (
    <header className="shrink-0 border-b border-black/5 bg-ink-900 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-center text-white">
      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
        Interior Simulator AI
      </p>
      <h1 className="mt-1 text-[15px] font-semibold leading-snug tracking-tight">
        인테리어 시뮬레이터 AI
        <span className="mx-1.5 font-normal text-white/40">-</span>
        가구/타일 시뮬레이터
      </h1>
      <div className="mt-2">
        <AuthStatus />
      </div>
    </header>
  )
}

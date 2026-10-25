import AuthStatus from "@/components/AuthStatus"

export default function Header() {
  return (
    <header className="app-header shrink-0 border-b border-black/5 bg-ink-900 px-4 pb-2.5 pt-[max(0.65rem,env(safe-area-inset-top))] text-center text-white">
      <p className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-white/55 min-[400px]:block">
        Interior Simulator AI
      </p>
      <h1 className="text-[14px] font-semibold leading-tight tracking-tight sm:text-[15px]">
        인테리어 시뮬레이터 AI
      </h1>
      <p className="mt-0.5 text-[11px] leading-none text-white/50">
        가구/타일 시뮬레이터
      </p>
      <div className="mt-1.5">
        <AuthStatus />
      </div>
    </header>
  )
}

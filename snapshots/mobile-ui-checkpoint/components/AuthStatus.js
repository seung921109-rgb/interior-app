"use client"

import Link from "next/link"
import { useAuth } from "@/context/AuthContext"

export default function AuthStatus() {
  const auth = useAuth()

  const remaining = Number(auth.remaining ?? 0)

  if (auth.configured && auth.loading) {
    return <p className="text-[11px] text-white/55">로그인 확인 중...</p>
  }

  if (!auth.user) {
    return (
      <div className="flex items-center justify-center gap-2">
        <p className="text-[11px] text-white/70">남은 {remaining}회</p>
        {auth.configured ? (
          <Link
            href="/login"
            className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white active:bg-white/20"
          >
            카카오 로그인
          </Link>
        ) : null}
      </div>
    )
  }

  const name = auth.profile?.display_name || "로그인됨"

  return (
    <div className="flex items-center justify-center gap-2">
      <p className="truncate text-[11px] text-white/80">
        {name}
        <span className="text-white/55"> · 남은 {remaining}회</span>
      </p>
      <button
        type="button"
        onClick={() => auth.signOut()}
        className="shrink-0 text-[11px] text-white/55 underline-offset-2 active:text-white"
      >
        로그아웃
      </button>
    </div>
  )
}

"use client"

import Link from "next/link"
import { useAuth } from "@/context/AuthContext"

export default function AuthStatus() {
  const auth = useAuth()

  if (!auth.configured) return null

  if (auth.loading) {
    return <p className="text-[11px] text-white/55">로그인 확인 중...</p>
  }

  if (!auth.user) {
    return (
      <Link
        href="/login"
        className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-white active:bg-white/20"
      >
        카카오 로그인
      </Link>
    )
  }

  const name = auth.profile?.display_name || "로그인됨"
  const remaining = auth.remaining

  return (
    <div className="flex items-center justify-center gap-2">
      <p className="truncate text-[11px] text-white/80">
        {name}
        {typeof remaining === "number" ? (
          <span className="text-white/55"> · 무료 {remaining}회</span>
        ) : null}
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

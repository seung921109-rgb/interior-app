"use client"

import { useState } from "react"
import { useAuth } from "@/context/AuthContext"

export default function KakaoLoginButton({ className = "" }) {
  const auth = useAuth()
  const [error, setError] = useState("")

  if (!auth.configured) {
    return (
      <p className="text-center text-xs text-stone-500">
        카카오 로그인을 쓰려면 `.env.local`에 Supabase 키를 넣고, SQL 마이그레이션을
        실행하세요.
      </p>
    )
  }

  async function onClick() {
    try {
      setError("")
      await auth.signInWithKakao()
    } catch (err) {
      setError(err.message || "카카오 로그인에 실패했습니다.")
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-11 w-full select-none items-center justify-center gap-2 rounded-xl bg-[#FEE500] text-sm font-semibold text-[#191919] active:bg-[#f0d800]"
      >
        <KakaoIcon />
        카카오로 시작하기
      </button>
      {error ? (
        <p className="mt-2 text-center text-xs text-red-600" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        fill="currentColor"
        d="M12 4c-5.05 0-9.15 3.2-9.15 7.15 0 2.54 1.7 4.77 4.26 6.05l-.86 3.16c-.08.28.24.5.48.35l3.77-2.5c.48.05.97.08 1.5.08 5.05 0 9.15-3.2 9.15-7.14C21.15 7.2 17.05 4 12 4z"
      />
    </svg>
  )
}

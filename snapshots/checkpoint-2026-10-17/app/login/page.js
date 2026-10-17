"use client"

import { useSearchParams } from "next/navigation"
import KakaoLoginButton from "@/components/KakaoLoginButton"
import WorkArea from "@/components/WorkArea"
import { useAuth } from "@/context/AuthContext"

export default function LoginPage() {
  const auth = useAuth()
  const params = useSearchParams()
  const failed = params.get("error") === "kakao"

  return (
    <WorkArea
      title="카카오 로그인"
      description="로그인하면 무료 사용 횟수 3회가 계정에 저장됩니다."
    >
      <div className="flex flex-col gap-4 pt-6">
        {auth.user ? (
          <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center">
            <p className="text-sm font-medium text-ink-900">
              {auth.profile?.display_name || "로그인됨"}
            </p>
            <p className="mt-1 text-xs text-stone-500">
              남은 무료 횟수 {auth.remaining ?? "-"}회
            </p>
          </div>
        ) : (
          <>
            {failed ? (
              <p className="text-center text-xs text-red-600">
                카카오 로그인에 실패했습니다. 다시 시도해 주세요.
              </p>
            ) : null}
            <KakaoLoginButton />
            <p className="text-center text-[11px] leading-relaxed text-stone-500">
              Supabase Auth의 Kakao provider와 Redirect URL
              (`/auth/callback`)을 켜 두어야 합니다.
            </p>
          </>
        )}
      </div>
    </WorkArea>
  )
}

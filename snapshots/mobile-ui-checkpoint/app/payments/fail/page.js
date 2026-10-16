"use client"

import { Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import WorkArea from "@/components/WorkArea"

function PaymentFailBody() {
  const params = useSearchParams()
  const router = useRouter()
  const message = params.get("message") || "결제가 취소되었거나 실패했습니다."

  return (
    <WorkArea title="결제 실패" description="다시 시도하면 간편결제 창을 열 수 있습니다.">
      <p className="pt-6 text-center text-sm text-red-600">{message}</p>
      <button
        type="button"
        onClick={() => router.replace("/palette")}
        className="mt-4 min-h-11 w-full rounded-xl bg-ink-900 text-sm font-medium text-white"
      >
        돌아가기
      </button>
    </WorkArea>
  )
}

export default function PaymentFailPage() {
  return (
    <Suspense fallback={<WorkArea title="결제 실패" description="잠시만 기다려 주세요." />}>
      <PaymentFailBody />
    </Suspense>
  )
}

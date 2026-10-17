"use client"

import { Suspense, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import WorkArea from "@/components/WorkArea"
import { useAuth } from "@/context/AuthContext"
import { usePreview } from "@/context/PreviewContext"

function PaymentSuccessBody() {
  const params = useSearchParams()
  const router = useRouter()
  const auth = useAuth()
  const preview = usePreview()
  const [message, setMessage] = useState("결제를 확인하고 횟수를 충전하는 중...")
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (auth.loading) return
    const paymentKey = params.get("paymentKey")
    const orderId = params.get("orderId")
    const amount = Number(params.get("amount"))

    let cancelled = false
    async function confirm() {
      try {
        const res = await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ paymentKey, orderId, amount }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || "충전 실패")
        if (cancelled) return
        await auth.refreshProfile()
        preview.unlockLivePreview()
        setMessage(`결제가 완료되었습니다. 변환 ${data.remaining ?? 1}회를 사용할 수 있습니다.`)
        setTimeout(() => router.replace("/palette?paid=1"), 800)
      } catch (error) {
        if (cancelled) return
        setFailed(true)
        setMessage(error.message || "결제 확인에 실패했습니다.")
      }
    }
    confirm()
    return () => {
      cancelled = true
    }
  }, [auth.loading, params])

  return (
    <WorkArea title="결제 완료" description="토스페이먼츠 승인을 확인하고 있습니다.">
      <p className={`pt-6 text-center text-sm ${failed ? "text-red-600" : "text-stone-600"}`}>
        {message}
      </p>
      {failed ? (
        <button
          type="button"
          onClick={() => router.replace("/palette")}
          className="mt-4 min-h-11 w-full rounded-xl bg-ink-900 text-sm font-medium text-white"
        >
          돌아가기
        </button>
      ) : null}
    </WorkArea>
  )
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<WorkArea title="결제 완료" description="잠시만 기다려 주세요." />}>
      <PaymentSuccessBody />
    </Suspense>
  )
}

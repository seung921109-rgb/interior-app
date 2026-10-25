"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { loadTossPayments } from "@tosspayments/tosspayments-sdk"
import { useAuth } from "@/context/AuthContext"
import {
  CREDIT_AMOUNT,
  CREDIT_ORDER_NAME,
  getTossClientKey,
  tossCustomerKey,
} from "@/lib/payments"

export default function PaywallModal({ open, onClose }) {
  const auth = useAuth()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  if (!open) return null

  async function startPayment() {
    if (busy) return
    setError("")
    if (!auth.user) {
      router.push("/login?next=/palette")
      return
    }
    const clientKey = getTossClientKey()
    if (!clientKey) {
      setError("토스페이먼츠 클라이언트 키가 없습니다.")
      return
    }

    setBusy(true)
    try {
      const prepared = await fetch("/api/payments/prepare", { method: "POST" })
      const order = await prepared.json()
      if (!prepared.ok) {
        throw new Error(order.error || "주문을 시작하지 못했습니다.")
      }

      const tossPayments = await loadTossPayments(clientKey)
      const payment = tossPayments.payment({
        customerKey: tossCustomerKey(order.customerKey || auth.user.id),
      })

      await payment.requestPayment({
        method: "CARD",
        amount: {
          currency: "KRW",
          value: CREDIT_AMOUNT,
        },
        orderId: order.orderId,
        orderName: CREDIT_ORDER_NAME,
        successUrl: `${window.location.origin}/payments/success`,
        failUrl: `${window.location.origin}/payments/fail`,
        customerEmail: order.customerEmail || undefined,
        customerName: order.customerName || undefined,
      })
    } catch (err) {
      if (err?.code === "USER_CANCEL") {
        setError("결제를 취소했습니다.")
      } else {
        setError(err?.message || "결제창을 열지 못했습니다.")
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-8 sm:items-center sm:p-6"
      role="presentation"
      onClick={busy ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="paywall-title" className="text-base font-semibold text-ink-900">
          무료 횟수 소진
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          무료 횟수를 모두 소진했습니다. 500원 결제 후 이용하세요
        </p>
        {error ? (
          <p className="mt-3 text-xs text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="min-h-11 rounded-xl border border-stone-300 text-sm font-medium text-ink-800 disabled:opacity-40"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={startPayment}
            disabled={busy}
            className="min-h-11 rounded-xl bg-ink-900 text-sm font-medium text-white disabled:opacity-40"
          >
            {busy ? "결제창 여는 중..." : "500원 1회 결제"}
          </button>
        </div>
      </div>
    </div>
  )
}

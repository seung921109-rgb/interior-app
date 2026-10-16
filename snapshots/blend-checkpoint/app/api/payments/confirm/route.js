import { NextResponse } from "next/server"
import { CREDIT_AMOUNT, getTossSecretKey } from "@/lib/payments"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"

export async function POST(request) {
  const body = await request.json().catch(() => null)
  const paymentKey = String(body?.paymentKey || "")
  const orderId = String(body?.orderId || "")
  const amount = Number(body?.amount)

  if (!paymentKey || !orderId || amount !== CREDIT_AMOUNT) {
    return NextResponse.json(
      { error: "결제 정보가 올바르지 않습니다." },
      { status: 400 },
    )
  }

  const secret = getTossSecretKey()
  if (!secret) {
    return NextResponse.json(
      { error: "TOSS_SECRET_KEY가 없습니다." },
      { status: 500 },
    )
  }

  const supabase = createClient()
  if (!supabase) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 })
  }

  const { data: order, error: orderError } = await supabase
    .from("payments")
    .select("order_id, user_id, amount, status")
    .eq("order_id", orderId)
    .maybeSingle()

  if (orderError || !order || order.user_id !== user.id) {
    return NextResponse.json({ error: "주문을 찾을 수 없습니다." }, { status: 404 })
  }
  if (order.amount !== CREDIT_AMOUNT) {
    return NextResponse.json({ error: "결제 금액이 다릅니다." }, { status: 400 })
  }

  const encoded = Buffer.from(`${secret}:`).toString("base64")
  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: `Basic ${encoded}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount: CREDIT_AMOUNT }),
  })
  const tossJson = await tossRes.json().catch(() => ({}))
  if (!tossRes.ok) {
    return NextResponse.json(
      { error: tossJson.message || "결제 승인에 실패했습니다." },
      { status: tossRes.status },
    )
  }

  const admin = createAdminClient()
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY가 없어 횟수를 충전하지 못했습니다." },
      { status: 500 },
    )
  }

  const { data: remaining, error: creditError } = await admin.rpc(
    "credit_paid_order",
    {
      p_order_id: orderId,
      p_payment_key: paymentKey,
      p_amount: CREDIT_AMOUNT,
    },
  )

  if (creditError) {
    console.warn("credit_paid_order failed", creditError)
    return NextResponse.json(
      { error: "결제는 완료됐지만 횟수 충전에 실패했습니다." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    ok: true,
    remaining,
    method: tossJson.method || tossJson.easyPay?.provider || "CARD",
  })
}

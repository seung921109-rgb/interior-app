import { NextResponse } from "next/server"
import { CREDIT_AMOUNT, CREDIT_COUNT, createOrderId } from "@/lib/payments"
import { createClient } from "@/lib/supabase/server"

export async function POST() {
  const supabase = createClient()
  if (!supabase) {
    return NextResponse.json(
      { error: "로그인이 필요합니다." },
      { status: 401 },
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json(
      { error: "카카오 로그인 후 결제할 수 있습니다." },
      { status: 401 },
    )
  }

  const orderId = createOrderId()
  const { error } = await supabase.from("payments").insert({
    order_id: orderId,
    user_id: user.id,
    amount: CREDIT_AMOUNT,
    credits: CREDIT_COUNT,
    status: "pending",
  })

  if (error) {
    console.warn("payment prepare failed", error)
    return NextResponse.json(
      { error: "주문 정보를 만들지 못했습니다. payments 마이그레이션을 확인하세요." },
      { status: 500 },
    )
  }

  return NextResponse.json({
    orderId,
    amount: CREDIT_AMOUNT,
    orderName: "변환 1회",
    customerKey: user.id,
    customerEmail: user.email || "",
    customerName:
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.nickname ||
      "회원",
  })
}

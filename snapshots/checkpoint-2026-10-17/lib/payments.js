export const CREDIT_AMOUNT = 500
export const CREDIT_COUNT = 1
export const CREDIT_ORDER_NAME = "변환 1회"

export function getTossClientKey() {
  return process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || ""
}

export function getTossSecretKey() {
  return process.env.TOSS_SECRET_KEY || ""
}

export function createOrderId() {
  const rand = Math.random().toString(36).slice(2, 10)
  return `conv_${Date.now()}_${rand}`
}

export function tossCustomerKey(userId) {
  return String(userId || "guest")
    .replace(/[^0-9a-zA-Z\-_=.@]/g, "")
    .slice(0, 50)
}

"use client"

export default function PaywallModal({ open, onClose }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="paywall-title"
        className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="paywall-title" className="text-base font-semibold text-ink-900">
          무료 횟수 소진
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-stone-600">
          무료 횟수를 모두 소진했습니다. 500원 결제 후 이용하세요
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl border border-stone-300 text-sm font-medium text-ink-800"
          >
            닫기
          </button>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-xl bg-ink-900 text-sm font-medium text-white"
          >
            500원 결제
          </button>
        </div>
      </div>
    </div>
  )
}

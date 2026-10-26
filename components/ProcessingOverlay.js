"use client"

export default function ProcessingOverlay({ message = "처리 중입니다..." }) {
  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-ink-900/55 px-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex max-w-[16rem] flex-col items-center">
        <div
          className="h-12 w-12 animate-spin rounded-full border-[3px] border-white/25 border-t-white"
          aria-hidden
        />
        <p className="mt-3 text-center text-sm font-medium tracking-tight text-white">
          {message}
        </p>
      </div>
    </div>
  )
}

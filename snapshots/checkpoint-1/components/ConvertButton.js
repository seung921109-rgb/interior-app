"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import PaywallModal from "@/components/PaywallModal"
import { useAuth } from "@/context/AuthContext"
import { usePreview } from "@/context/PreviewContext"

export default function ConvertButton() {
  const preview = usePreview()
  const auth = useAuth()
  const router = useRouter()
  const params = useSearchParams()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const remaining = Number(auth.remaining ?? 0)
  const exhausted = remaining <= 0
  const canSelect = preview.hasMask && (preview.color || preview.texture)

  useEffect(() => {
    if (params.get("paid") !== "1") return
    preview.unlockLivePreview()
    let ignore = false
    auth.refreshProfile().finally(() => {
      if (!ignore) router.replace("/palette")
    })
    return () => {
      ignore = true
    }
  }, [params, preview, auth, router])

  async function onConvert() {
    if (busy) return
    if (exhausted) {
      setOpen(true)
      return
    }
    if (!canSelect) return

    setBusy(true)
    try {
      const used = await auth.consumeFreeCount()
      if (!used.ok) {
        setOpen(true)
        return
      }
      preview.commitSimulation()
      if (used.remaining <= 0) {
        setOpen(true)
      }
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onConvert}
        disabled={busy || (!exhausted && !canSelect)}
        className="flex min-h-11 w-full select-none items-center justify-center rounded-xl bg-clay-600 text-sm font-semibold text-white enabled:active:bg-clay-500 disabled:opacity-40"
      >
        {busy
          ? "변환 중..."
          : exhausted
            ? "변환하기 (횟수 소진)"
            : `변환하기 (남은 ${remaining}회)`}
      </button>
      <PaywallModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

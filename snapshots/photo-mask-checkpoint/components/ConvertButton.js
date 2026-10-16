"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import PaywallModal from "@/components/PaywallModal"
import { useAuth } from "@/context/AuthContext"
import { usePreview } from "@/context/PreviewContext"

export default function ConvertButton() {
  const preview = usePreview()
  const auth = useAuth()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const exhausted =
    auth.configured && auth.user && (auth.remaining ?? 0) <= 0
  const canSelect = preview.hasMask && (preview.color || preview.texture)

  useEffect(() => {
    if (exhausted) preview.lockLivePreview()
  }, [exhausted])

  async function onConvert() {
    if (busy) return
    if (exhausted) {
      setOpen(true)
      return
    }
    if (!canSelect) return
    if (auth.configured && !auth.user) {
      router.push("/login?next=/palette")
      return
    }

    setBusy(true)
    try {
      if (auth.configured && auth.user) {
        const used = await auth.consumeFreeCount()
        if (!used.ok) {
          preview.lockLivePreview()
          setOpen(true)
          return
        }
        preview.commitSimulation()
        if (used.remaining <= 0) {
          preview.lockLivePreview()
          setOpen(true)
        }
        return
      }
      preview.commitSimulation()
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onConvert}
        disabled={
          busy ||
          (auth.configured && auth.loading) ||
          (!exhausted && !canSelect)
        }
        className="flex min-h-12 w-full items-center justify-center rounded-xl bg-clay-600 text-sm font-semibold text-white enabled:active:bg-clay-500 disabled:opacity-40"
      >
        {busy
          ? "변환 중..."
          : exhausted
            ? "변환하기 (횟수 소진)"
            : typeof auth.remaining === "number"
              ? `변환하기 (남은 ${auth.remaining}회)`
              : "변환하기"}
      </button>
      <PaywallModal open={open} onClose={() => setOpen(false)} />
    </>
  )
}

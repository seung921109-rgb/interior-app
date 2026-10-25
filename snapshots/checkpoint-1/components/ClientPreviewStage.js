"use client"

import dynamic from "next/dynamic"

const PreviewStage = dynamic(() => import("@/components/PreviewStage"), {
  ssr: false,
  loading: () => (
    <div className="relative min-h-[140px] flex-1 overflow-hidden rounded-xl border border-stone-200 bg-ink-100" />
  ),
})

export default PreviewStage

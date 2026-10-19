"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { usePreview } from "@/context/PreviewContext"

export default function GoToConvertTab() {
  const preview = usePreview()
  if (!preview.hasMask) return null

  return (
    <Link
      href="/palette"
      className="absolute right-2 top-[42%] z-[8] flex min-h-[88px] w-11 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-2xl bg-clay-600 px-1.5 py-3 text-center text-[11px] font-semibold leading-tight text-white shadow-lg active:bg-clay-500"
    >
      <ChevronRight className="h-5 w-5" aria-hidden />
      변환하러
      <br />
      가기
    </Link>
  )
}

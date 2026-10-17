"use client"

import dynamic from "next/dynamic"

const FileUpload = dynamic(() => import("@/components/FileUpload"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[140px] flex-1 items-center justify-center rounded-xl border border-stone-200 bg-ink-100 text-sm text-stone-500">
      불러오는 중...
    </div>
  ),
})

export default FileUpload

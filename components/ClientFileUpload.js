"use client"

import dynamic from "next/dynamic"

const FileUpload = dynamic(() => import("@/components/FileUpload"), {
  ssr: false,
  loading: () => (
    <section className="flex h-full min-h-0 flex-col bg-ink-50">
      <div className="work-head shrink-0 px-4 pb-2 pt-3">
        <h2 className="text-base font-semibold leading-tight text-ink-900">영역 설정</h2>
        <p className="mt-0.5 text-xs leading-snug text-stone-500">
          카메라 또는 갤러리에서 사진을 먼저 올려 주세요.
        </p>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pb-3 text-sm text-stone-500">
        불러오는 중...
      </div>
    </section>
  ),
})

export default FileUpload

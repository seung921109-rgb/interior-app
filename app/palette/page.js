"use client"

import { Suspense } from "react"
import ConvertButton from "@/components/ConvertButton"
import FinishPicker from "@/components/FinishPicker"
import PreviewStage from "@/components/PreviewStage"
import RestoreOriginalButton from "@/components/RestoreOriginalButton"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"

export default function PalettePage() {
  const preview = usePreview()

  return (
    <WorkArea
      fill
      title="컬러/텍스처 선택"
      description="색이나 필름을 고른 뒤, 원본과 비교하려면 아래 되돌리기를 누르세요. 변환하기를 누르면 1회가 차감됩니다."
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <div className="flex min-h-[160px] flex-[1.15] flex-col">
          <PreviewStage
            mode="finish"
            emptyTitle="먼저 사진을 올려 주세요"
            emptyDescription="사진 업로드 탭에서 영역을 선택한 뒤 여기에 돌아와 마감재를 고르세요."
          />
        </div>
        <div className="flex min-h-0 max-h-[54%] shrink-0 flex-col gap-2">
          {preview.hint ? (
            <p className="line-clamp-2 shrink-0 text-center text-[11px] leading-snug text-stone-500">
              {preview.hint}
            </p>
          ) : null}
          {preview.hasImage && !preview.hasMask ? (
            <p className="shrink-0 text-center text-[11px] leading-snug text-stone-500">
              선택된 영역이 없습니다. 사진 업로드 탭에서 가구를 다시 지정하세요.
            </p>
          ) : null}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain scroll-touch">
            <FinishPicker />
          </div>
          <div className="shrink-0 space-y-2">
            <Suspense>
              <ConvertButton />
            </Suspense>
            <RestoreOriginalButton />
          </div>
        </div>
      </div>
    </WorkArea>
  )
}

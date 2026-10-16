"use client"

import { Suspense } from "react"
import ConvertButton from "@/components/ConvertButton"
import FinishPicker from "@/components/FinishPicker"
import PreviewStage from "@/components/PreviewStage"
import ResetAreaButton from "@/components/ResetAreaButton"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"

export default function PalettePage() {
  const preview = usePreview()

  return (
    <WorkArea
      fill
      title="컬러/텍스처 선택"
      description="필름을 고른 뒤 변환하기를 누르면 1회가 차감됩니다."
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex min-h-0 flex-1 flex-col">
          <PreviewStage
            mode="finish"
            emptyTitle="먼저 사진을 올려 주세요"
            emptyDescription="사진 업로드 탭에서 영역을 선택한 뒤 여기에 돌아와 마감재를 고르세요."
          />
        </div>
        {preview.hint ? (
          <p className="text-center text-[11px] text-stone-500">{preview.hint}</p>
        ) : null}
        {preview.hasImage && !preview.hasMask ? (
          <p className="text-center text-[11px] text-stone-500">
            선택된 영역이 없습니다. 사진 업로드 탭에서 가구를 다시 지정하세요.
          </p>
        ) : null}
        <div className="shrink-0 space-y-2">
          <FinishPicker />
          <Suspense>
            <ConvertButton />
          </Suspense>
          <ResetAreaButton className="w-full" />
        </div>
      </div>
    </WorkArea>
  )
}

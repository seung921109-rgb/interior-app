"use client"

import FinishPicker from "@/components/FinishPicker"
import PreviewStage from "@/components/PreviewStage"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"

export default function PalettePage() {
  const preview = usePreview()

  return (
    <WorkArea
      fill
      title="컬러/텍스처 선택"
      description="선택한 영역에 색상과 재질을 입힙니다."
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex min-h-[180px] flex-[1.1] flex-col">
          <PreviewStage
            mode="finish"
            emptyTitle="먼저 사진을 올려 주세요"
            emptyDescription="사진 업로드 탭에서 영역을 선택한 뒤 여기에 돌아와 마감재를 고르세요."
          />
        </div>
        {preview.hasImage && !preview.hasMask ? (
          <p className="text-center text-[11px] text-stone-500">
            선택된 영역이 없습니다. 사진 업로드 탭에서 가구·벽면을 지정하세요.
          </p>
        ) : null}
        <div className="min-h-0 max-h-[48%] overflow-y-auto overscroll-contain">
          <FinishPicker />
        </div>
      </div>
    </WorkArea>
  )
}

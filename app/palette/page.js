"use client"

import Link from "next/link"
import { Suspense } from "react"
import { PencilLine } from "lucide-react"
import ConvertButton from "@/components/ConvertButton"
import FinishPicker from "@/components/FinishPicker"
import PreviewStage from "@/components/ClientPreviewStage"
import RestoreOriginalButton from "@/components/RestoreOriginalButton"
import TargetSwitcher from "@/components/TargetSwitcher"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"

export default function PalettePage() {
  const preview = usePreview()

  if (!preview.hasImage) {
    return (
      <WorkArea
        fill
        title="컬러/텍스처 선택"
        description="영역 설정에서 사진을 올리고 가구를 지정한 뒤, 여기서 색과 필름을 고르세요."
      >
        <div className="flex h-full min-h-0 flex-col">
          <PreviewStage
            mode="finish"
            emptyTitle="먼저 사진을 올려 주세요"
            emptyDescription="영역 설정 탭에서 카메라 또는 갤러리로 사진을 올린 뒤, 가구 영역을 선택하고 돌아와 마감재를 고르세요."
          />
        </div>
      </WorkArea>
    )
  }

  return (
    <WorkArea immersive>
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <PreviewStage
            mode="finish"
            fit="contain"
            bleed
            emptyTitle="먼저 사진을 올려 주세요"
            emptyDescription="영역 설정 탭에서 사진을 올린 뒤 가구 영역을 선택하세요."
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[7] flex w-[5.35rem] flex-col bg-gradient-to-l from-ink-900/80 via-ink-900/35 to-transparent pt-[max(0.5rem,env(safe-area-inset-top))] pr-1.5">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
              <FinishPicker layout="rail" />
            </div>
          </div>
          {preview.targets?.length ? (
            <div className="pointer-events-none absolute inset-x-0 top-[max(0.5rem,env(safe-area-inset-top))] z-[6] flex justify-start px-2 pr-[5.6rem]">
              <div className="pointer-events-auto">
                <TargetSwitcher
                  tone="dark"
                  targets={preview.targets}
                  activeTargetId={preview.activeTargetId}
                  onSelect={(id) => preview.setActiveTarget(id)}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-white/10 bg-ink-900 px-2 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
          {preview.hasImage && !preview.hasMask ? (
            <p className="text-center text-[11px] text-white/70">
              선택된 영역이 없습니다. 영역 설정에서 가구를 지정하세요.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-1.5">
            <Link
              href="/"
              className="flex min-h-9 select-none items-center justify-center gap-1 rounded-xl bg-white/10 text-[11px] font-medium text-white active:bg-white/16"
            >
              <PencilLine className="h-3.5 w-3.5" aria-hidden />
              영역 수정
            </Link>
            <RestoreOriginalButton
              compact
              className="flex min-h-9 w-full select-none items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/10 text-[11px] font-medium text-white enabled:active:bg-white/16 disabled:opacity-40"
            />
          </div>
          <Suspense>
            <ConvertButton className="flex min-h-10 w-full select-none items-center justify-center rounded-xl bg-clay-600 text-sm font-semibold text-white enabled:active:bg-clay-500 disabled:opacity-40" />
          </Suspense>
          <Link
            href="/save"
            className="flex min-h-8 items-center justify-center text-[11px] font-medium text-white/75"
          >
            저장하러 가기
          </Link>
        </div>
      </div>
    </WorkArea>
  )
}

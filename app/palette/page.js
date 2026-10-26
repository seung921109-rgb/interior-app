"use client"

import Link from "next/link"
import { Suspense, useRef } from "react"
import { PencilLine } from "lucide-react"
import CompareButton from "@/components/CompareButton"
import RegionBar from "@/components/RegionBar"
import ResetAreaButton from "@/components/ResetAreaButton"
import ConvertButton from "@/components/ConvertButton"
import FinishPicker from "@/components/FinishPicker"
import PreviewStage from "@/components/ClientPreviewStage"
import RestoreOriginalButton from "@/components/RestoreOriginalButton"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"
import { pointerToWorkingPoint } from "@/lib/canvas"

export default function PalettePage() {
  const preview = usePreview()
  const previewRef = useRef(preview)
  const tapRef = useRef(null)
  previewRef.current = preview

  function tapPoint(event) {
    const current = previewRef.current
    if (!current.hasImage || current.analyzing) return null
    if (typeof event?.type === "string" && event.type.startsWith("touch") && typeof PointerEvent === "function") {
      return null
    }
    current.prepareFrame()
    const { width, height } = current.getSize()
    if (!width || !height) return null
    return pointerToWorkingPoint(event, event.currentTarget, width, height, {
      fit: "contain",
      view: current.imageView,
    })
  }

  function onPointerDown(event) {
    const point = tapPoint(event)
    if (!point) return
    event.preventDefault()
    tapRef.current = point
    try {
      if (event.pointerId != null) event.currentTarget.setPointerCapture?.(event.pointerId)
    } catch {
      // pointer id is only valid for a real contact
    }
  }

  function onPointerUp(event) {
    const start = tapRef.current
    tapRef.current = null
    try {
      if (event.pointerId != null) event.currentTarget.releasePointerCapture?.(event.pointerId)
    } catch {
      // already released
    }
    const point = tapPoint(event) || start
    if (!point) return
    const current = previewRef.current
    void current.fillFromPoint(point.x, point.y)
  }

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
            enabled={preview.hasImage && !preview.analyzing}
            banner={
              preview.hasMask
                ? "영역 버튼을 바꾼 뒤 다른 색이나 필름을 고르면 그 면만 바뀝니다"
                : "영역 1에 면을 터치하세요"
            }
            drawTool="tap"
            onPointerDown={onPointerDown}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            emptyTitle="먼저 사진을 올려 주세요"
            emptyDescription="영역 설정 탭에서 사진을 올린 뒤 가구 영역을 선택하세요."
          />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-[7] flex w-[5.35rem] flex-col bg-gradient-to-l from-ink-900/80 via-ink-900/35 to-transparent pt-[max(0.5rem,env(safe-area-inset-top))] pr-1.5">
            <div className="pointer-events-auto flex min-h-0 flex-1 flex-col">
              <FinishPicker layout="rail" />
            </div>
          </div>
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-white/10 bg-ink-900 px-2 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
          {preview.hasImage && !preview.hasMask ? (
            <p className="text-center text-[11px] text-white/70">
              선택한 영역에 면을 터치한 뒤 색이나 필름을 고르세요.
            </p>
          ) : null}
          <RegionBar />
          <div className="grid grid-cols-2 gap-1.5">
            <CompareButton className="min-h-9 w-full bg-white/10 text-[10px] text-white" />
            <ResetAreaButton
              scope="finish"
              label="초기화"
              className="min-h-9 w-full border-white/15 bg-white/10 text-[10px] text-white enabled:active:bg-white/16"
            />
          </div>
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

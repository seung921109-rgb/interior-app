"use client"

import { useState } from "react"
import PreviewStage from "@/components/PreviewStage"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"

export default function SavePage() {
  const preview = usePreview()
  const [message, setMessage] = useState("")

  async function download() {
    const finished = preview.getFinishedImage()
    if (!finished) {
      setMessage("저장할 결과가 없습니다.")
      return
    }
    const canvas = document.createElement("canvas")
    canvas.width = finished.width
    canvas.height = finished.height
    canvas.getContext("2d").putImageData(finished, 0, 0)
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = "interior-preview.png"
    link.click()
    URL.revokeObjectURL(url)
    setMessage("미리보기 이미지를 저장했습니다.")
  }

  return (
    <WorkArea
      fill
      title="결과 저장"
      description="변환된 결과를 이미지로 저장합니다. 횟수는 변환 시 차감됩니다."
    >
      <div className="flex h-full min-h-0 flex-col gap-3">
        <PreviewStage
          mode="finish"
          emptyTitle="저장된 결과가 없습니다"
          emptyDescription="사진을 올리고 영역을 선택한 뒤 컬러/텍스처를 적용하세요."
        />
        <button
          type="button"
          onClick={download}
          disabled={!preview.hasImage || !preview.hasMask}
          className="flex min-h-12 items-center justify-center rounded-xl bg-ink-900 text-sm font-medium text-white enabled:active:bg-ink-800 disabled:opacity-40"
        >
          결과 PNG 저장
        </button>
        {message ? (
          <p className="text-center text-xs text-stone-500">{message}</p>
        ) : null}
      </div>
    </WorkArea>
  )
}

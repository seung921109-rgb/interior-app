"use client"

import { useState } from "react"
import { Download } from "lucide-react"
import PreviewStage from "@/components/PreviewStage"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"
import {
  exportFilename,
  imageDataToBlob,
  renderExportImageData,
  saveImageBlob,
} from "@/lib/exportResult"

export default function SavePage() {
  const preview = usePreview()
  const [message, setMessage] = useState("")
  const [busy, setBusy] = useState(false)

  const hasFinish = Boolean(
    preview.displayColor || preview.displayTexture,
  )
  const canSave = preview.hasImage && preview.hasMask && hasFinish

  async function download(kind) {
    if (busy) return
    preview.prepareFrame()
    const source = preview.getSource()
    const { width, height } = preview.getSize()
    const imageData = renderExportImageData({
      source,
      mask: preview.getMask(),
      workWidth: width,
      workHeight: height,
      color: preview.displayColor,
      texture: preview.displayTexture,
    })
    if (!imageData) {
      setMessage("저장할 결과가 없습니다. 영역과 자재를 먼저 적용하세요.")
      return
    }

    setBusy(true)
    setMessage("고화질 이미지를 만드는 중...")
    try {
      const mime = kind === "jpeg" ? "image/jpeg" : "image/png"
      const filename = exportFilename(kind)
      const blob = await imageDataToBlob(imageData, mime, 0.95)
      const result = await saveImageBlob(blob, filename)
      if (result === "cancelled") {
        setMessage("저장이 취소되었습니다.")
        return
      }
      setMessage(
        result === "shared"
          ? "공유 화면에서 사진 앱이나 파일로 저장하세요."
          : `${kind === "jpeg" ? "JPG" : "PNG"} 파일을 저장했습니다.`,
      )
    } catch (error) {
      setMessage(error.message || "이미지를 저장하지 못했습니다.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <WorkArea
      fill
      title="결과 저장"
      description="완성된 시뮬레이션을 고화질 PNG 또는 JPG로 휴대폰·PC에 바로 저장합니다."
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        <PreviewStage
          mode="finish"
          emptyTitle="저장된 결과가 없습니다"
          emptyDescription="사진을 올리고 영역을 선택한 뒤 컬러/텍스처를 적용하세요."
        />
        <div className="grid shrink-0 grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => download("png")}
            disabled={!canSave || busy}
            className="flex min-h-11 select-none items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 text-sm font-medium text-white enabled:active:bg-ink-800 disabled:opacity-40"
          >
            <Download className="h-4 w-4" aria-hidden />
            {busy ? "저장 중..." : "PNG 저장"}
          </button>
          <button
            type="button"
            onClick={() => download("jpeg")}
            disabled={!canSave || busy}
            className="flex min-h-11 select-none items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-ink-900 enabled:active:bg-ink-50 disabled:opacity-40"
          >
            {busy ? "저장 중..." : "JPG 저장"}
          </button>
        </div>
        {message ? (
          <p className="text-center text-xs text-stone-500">{message}</p>
        ) : !preview.hasImage ? (
          <p className="text-center text-xs text-stone-500">
            사진과 자재를 적용한 뒤 여기에서 결과를 받을 수 있습니다.
          </p>
        ) : !preview.hasMask ? (
          <p className="text-center text-xs text-stone-500">
            사진 업로드 탭에서 가구 영역을 먼저 지정하세요.
          </p>
        ) : !hasFinish ? (
          <p className="text-center text-xs text-stone-500">
            컬러/텍스처 탭에서 자재를 적용한 뒤 저장하세요.
          </p>
        ) : null}
      </div>
    </WorkArea>
  )
}

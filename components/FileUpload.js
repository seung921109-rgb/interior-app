"use client"

import { useRef, useState } from "react"
import { Camera, ImageUp, RefreshCw, Sparkles, WandSparkles } from "lucide-react"
import GoToConvertTab from "@/components/GoToConvertTab"
import MaskDrawTools, { brushRadiusForSize } from "@/components/MaskDrawTools"
import PreviewStage from "@/components/ClientPreviewStage"
import ResetAreaButton from "@/components/ResetAreaButton"
import SubjectPickerSheet from "@/components/SubjectPickerSheet"
import TargetSwitcher from "@/components/TargetSwitcher"
import WorkArea from "@/components/WorkArea"
import { usePreview } from "@/context/PreviewContext"
import { pointerToWorkingPoint } from "@/lib/canvas"

export default function FileUpload() {
  const preview = usePreview()
  const cameraInputRef = useRef(null)
  const galleryInputRef = useRef(null)
  const drawingRef = useRef(false)
  const startPointRef = useRef(null)
  const lastPointRef = useRef(null)
  const maskToolRef = useRef("tap")
  const brushSizeRef = useRef("s")
  const [error, setError] = useState("")
  const [maskTool, setMaskTool] = useState("tap")
  const [brushSize, setBrushSize] = useState("s")
  maskToolRef.current = maskTool
  brushSizeRef.current = brushSize

  function strokeValue() {
    return maskToolRef.current === "erase" ? 0 : 255
  }

  function strokeRadius() {
    return brushRadiusForSize(brushSizeRef.current)
  }

  function paintStroke(from, to) {
    preview.paintBrush(from, to, strokeRadius(), strokeValue())
  }

  function eventPoint(event, canvas) {
    preview.prepareFrame()
    const { width, height } = preview.getSize()
    if (!width || !height) return null
    return pointerToWorkingPoint(event, canvas || event.currentTarget, width, height, {
      fit: "contain",
    })
  }

  function isDuplicateTouch(event) {
    return (
      typeof PointerEvent === "function" &&
      typeof event?.type === "string" &&
      event.type.startsWith("touch")
    )
  }

  function startMask(event) {
    if (!preview.hasImage || !preview.subjects?.length || preview.analyzing) return
    if (isDuplicateTouch(event)) return
    event.preventDefault()
    const point = eventPoint(event)
    if (!point) return
    drawingRef.current = true
    startPointRef.current = point
    lastPointRef.current = point
    if (event.pointerId != null) {
      event.currentTarget.setPointerCapture?.(event.pointerId)
    }
    if (maskToolRef.current !== "tap") {
      paintStroke(null, point)
    }
  }

  function moveMask(event) {
    if (!drawingRef.current || !preview.hasImage) return
    if (isDuplicateTouch(event)) return
    event.preventDefault()
    const canvas = event.currentTarget
    const extras =
      maskToolRef.current !== "tap" && typeof event.getCoalescedEvents === "function"
        ? event.getCoalescedEvents()
        : null
    if (extras?.length) {
      for (const extra of extras) {
        const point = eventPoint(extra, canvas)
        if (!point) continue
        paintStroke(lastPointRef.current, point)
        lastPointRef.current = point
      }
      return
    }
    const point = eventPoint(event, canvas)
    if (!point) return
    if (maskToolRef.current !== "tap") {
      paintStroke(lastPointRef.current, point)
    }
    lastPointRef.current = point
  }

  function endMask(event) {
    if (isDuplicateTouch(event)) return
    if (!drawingRef.current) return
    drawingRef.current = false
    const tool = maskToolRef.current
    const start = startPointRef.current
    const last = lastPointRef.current
    startPointRef.current = null
    lastPointRef.current = null
    try {
      if (event.pointerId != null) {
        event.currentTarget.releasePointerCapture?.(event.pointerId)
      }
    } catch {
      // already released
    }
    if (tool !== "tap") {
      const point = eventPoint(event)
      if (point && last) paintStroke(last, point)
      return
    }
    const end = eventPoint(event) || last || start
    if (!end) return
    void preview.fillFromPoint(end.x, end.y)
  }

  async function onInputChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file) return
    try {
      setError("")
      await preview.loadFile(file)
    } catch (err) {
      setError(err.message || "사진을 불러오지 못했습니다.")
    }
  }

  const fileInputs = (
    <>
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        data-source="camera"
        className="sr-only"
        onChange={onInputChange}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        data-source="gallery"
        className="sr-only"
        onChange={onInputChange}
      />
    </>
  )

  if (!preview.hasImage) {
    return (
      <WorkArea
        fill
        title="사진 업로드"
        description="카메라로 촬영하거나 갤러리에서 사진을 먼저 올려 주세요. 사진이 올라간 뒤에 가구 영역을 선택할 수 있습니다."
      >
        <div className="flex h-full min-h-0 flex-col gap-3">
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-xl border border-stone-200 bg-ink-100 px-6 text-center">
            <p className="text-sm font-medium text-ink-800">
              가구 또는 화장실 사진을 올려 주세요
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-500">
              스마트폰 카메라로 찍거나, 사진첩에서 이미지를 선택하세요.
            </p>
          </div>
          {error ? (
            <p className="text-center text-xs text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <div className="grid shrink-0 grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-14 select-none items-center justify-center gap-2 rounded-xl bg-ink-900 px-3 text-sm font-medium text-white active:bg-ink-800"
            >
              <Camera className="h-5 w-5" aria-hidden />
              카메라
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex min-h-14 select-none items-center justify-center gap-2 rounded-xl border border-stone-300 bg-white px-3 text-sm font-medium text-ink-900 active:bg-ink-50"
            >
              <ImageUp className="h-5 w-5" aria-hidden />
              갤러리
            </button>
          </div>
          {fileInputs}
        </div>
      </WorkArea>
    )
  }

  const pickingSubject = Boolean(preview.hasImage && !preview.subjects?.length)

  return (
    <WorkArea immersive>
      <div className="flex h-full min-h-0 flex-col">
        <div className="relative flex min-h-0 flex-1 flex-col">
          <PreviewStage
            mode="select"
            fit="contain"
            bleed
            enabled={!pickingSubject && !preview.analyzing}
            banner={
              pickingSubject
                ? "바꿀 사물이나 영역을 최대 2개까지 고르세요"
                : maskTool === "brush"
                  ? "가늘게 칠해 빠진 면을 더하세요"
                  : maskTool === "erase"
                    ? "가늘게 문질러 넘치는 면을 지우세요"
                    : preview.hasMask
                      ? "빈공간이 있다면 그곳을 터치해 경계를 더하세요"
                      : "벽이나 가구를 터치하면 그 면을 잡습니다"
            }
            onPointerDown={startMask}
            onPointerMove={moveMask}
            onPointerUp={endMask}
            onTouchStart={startMask}
            onTouchMove={moveMask}
            onTouchEnd={endMask}
          />
          {!pickingSubject ? <GoToConvertTab /> : null}
          {pickingSubject ? (
            <SubjectPickerSheet onConfirm={(items) => preview.setSubjects(items)} />
          ) : null}
        </div>

        <div className="shrink-0 space-y-1.5 border-t border-white/10 bg-ink-900 px-2 pt-2 pb-[max(0.55rem,env(safe-area-inset-bottom))]">
          {error ? (
            <p className="text-center text-xs text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          {preview.subjects?.length ? (
            <div className="flex items-center justify-between gap-2">
              <TargetSwitcher
                tone="dark"
                targets={preview.targets}
                activeTargetId={preview.activeTargetId}
                onSelect={(id) => preview.setActiveTarget(id)}
              />
              <button
                type="button"
                data-subjects={JSON.stringify(preview.subjects)}
                onClick={() => preview.setSubjects([])}
                className="shrink-0 rounded-full bg-white/12 px-2.5 py-1 text-[10px] font-medium text-white/85"
              >
                용도 변경
              </button>
            </div>
          ) : null}

          {!pickingSubject ? (
            <MaskDrawTools
              dock
              tool={maskTool}
              onTool={setMaskTool}
              sizeId={brushSize}
              onSize={setBrushSize}
            />
          ) : null}

          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="flex min-h-9 select-none items-center justify-center gap-1 rounded-xl bg-white/10 text-[10px] font-medium text-white active:bg-white/16"
            >
              <Camera className="h-3.5 w-3.5" aria-hidden />
              촬영
            </button>
            <button
              type="button"
              onClick={() => galleryInputRef.current?.click()}
              className="flex min-h-9 select-none items-center justify-center gap-1 rounded-xl bg-white/10 text-[10px] font-medium text-white active:bg-white/16"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
              변경
            </button>
            <button
              type="button"
              onClick={() => preview.smartFill()}
              disabled={pickingSubject || !preview.hasMask}
              className="flex min-h-9 select-none items-center justify-center gap-1 rounded-xl bg-white/10 text-[10px] font-medium text-white enabled:active:bg-white/16 disabled:opacity-35"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              채우기
            </button>
            <button
              type="button"
              onClick={() => preview.refineRegion()}
              disabled={pickingSubject || !preview.hasMask}
              className="flex min-h-9 select-none items-center justify-center gap-1 rounded-xl bg-white/10 text-[10px] font-medium text-white enabled:active:bg-white/16 disabled:opacity-35"
            >
              <WandSparkles className="h-3.5 w-3.5" aria-hidden />
              다듬기
            </button>
          </div>
          {!pickingSubject ? (
            <ResetAreaButton className="min-h-9 w-full border-white/15 bg-white/10 text-xs text-white enabled:active:bg-white/16" />
          ) : null}
        </div>
        {fileInputs}
      </div>
    </WorkArea>
  )
}

import { rasterizeSource } from "@/lib/canvas"
import { applyFinish } from "@/lib/finish"
import { scaleMaskSmooth } from "@/lib/mask"

export const EXPORT_MAX_SIDE = 2048

function timestampName(ext) {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, "0")
  return `interior-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.${ext}`
}

export function renderExportImageData({
  source,
  mask,
  workWidth,
  workHeight,
  color,
  texture,
}) {
  if (!source || !mask?.length || !workWidth || !workHeight) return null
  const hi = rasterizeSource(source, EXPORT_MAX_SIDE)
  if (!hi) return null
  const exportMask =
    hi.width === workWidth && hi.height === workHeight
      ? mask
      : scaleMaskSmooth(mask, workWidth, workHeight, hi.width, hi.height)
  return applyFinish(hi, exportMask, color, texture)
}

export function imageDataToBlob(imageData, mimeType = "image/png", quality = 0.95) {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  const ctx = canvas.getContext("2d")
  if (mimeType === "image/jpeg") {
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.putImageData(imageData, 0, 0)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("이미지를 만들지 못했습니다."))),
      mimeType,
      quality,
    )
  })
}

export async function saveImageBlob(blob, filename) {
  const file = new File([blob], filename, { type: blob.type })
  const mobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
  if (
    mobile &&
    typeof navigator.canShare === "function" &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        files: [file],
        title: "인테리어 결과",
      })
      return "shared"
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled"
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return "downloaded"
}

export function exportFilename(kind) {
  return timestampName(kind === "jpeg" ? "jpg" : "png")
}

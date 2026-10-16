"use client"

import { selectionBounds } from "@/lib/mask"

function imageDataToUrl(imageData) {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext("2d").putImageData(imageData, 0, 0)
  return canvas.toDataURL("image/jpeg", 0.85)
}

function resizeMask(src, sw, sh, dw, dh) {
  const out = new Uint8Array(dw * dh)
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, Math.floor((y * sh) / dh))
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, Math.floor((x * sw) / dw))
      out[y * dw + x] = src[sy * sw + sx]
    }
  }
  return out
}

let segmenterPromise = null

async function getSegmenter() {
  if (typeof window === "undefined") {
    throw new Error("segmentation is browser-only")
  }
  if (!segmenterPromise) {
    segmenterPromise = (async () => {
      const { pipeline } = await import("@huggingface/transformers")
      return pipeline(
        "image-segmentation",
        "Xenova/segformer-b0-finetuned-ade-512-512",
        { dtype: "q8" },
      )
    })()
  }
  return segmenterPromise
}

export async function segmentScene(imageData) {
  const segmenter = await getSegmenter()
  const output = await segmenter(imageDataToUrl(imageData))
  const { width, height } = imageData
  const labels = new Array(width * height).fill("")
  const coverage = new Map()

  for (const item of output || []) {
    const label = item.label || ""
    const mask = item.mask
    if (!mask?.data || !label) continue
    const data = resizeMask(
      mask.data,
      mask.width,
      mask.height,
      width,
      height,
    )
    let count = 0
    for (let i = 0; i < data.length; i++) {
      if (data[i] < 128) continue
      labels[i] = label
      count++
    }
    coverage.set(label, (coverage.get(label) || 0) + count)
  }

  return { labels, coverage }
}

function cropImageData(imageData, box) {
  const w = box.maxX - box.minX + 1
  const h = box.maxY - box.minY + 1
  const out = new ImageData(w, h)
  const src = imageData.data
  const dst = out.data
  for (let y = 0; y < h; y++) {
    const sy = box.minY + y
    for (let x = 0; x < w; x++) {
      const si = (sy * imageData.width + (box.minX + x)) * 4
      const di = (y * w + x) * 4
      dst[di] = src[si]
      dst[di + 1] = src[si + 1]
      dst[di + 2] = src[si + 2]
      dst[di + 3] = src[si + 3]
    }
  }
  return out
}

function scaleImageData(imageData, maxSide) {
  const { width, height } = imageData
  const scale = maxSide / Math.max(width, height)
  const tw = Math.max(32, Math.round(width * scale))
  const th = Math.max(32, Math.round(height * scale))
  if (tw === width && th === height) return imageData
  const source = document.createElement("canvas")
  source.width = width
  source.height = height
  source.getContext("2d").putImageData(imageData, 0, 0)
  const target = document.createElement("canvas")
  target.width = tw
  target.height = th
  const ctx = target.getContext("2d")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, tw, th)
  return ctx.getImageData(0, 0, tw, th)
}

export async function segmentAroundMask(imageData, mask) {
  const { width, height } = imageData
  const pad = Math.round(Math.max(width, height) * 0.1)
  const box = selectionBounds(mask, width, height, pad)
  if (!box) return { labels: null, box: null }

  const crop = cropImageData(imageData, box)
  const scaled = scaleImageData(crop, 512)
  const { labels: scaledLabels } = await segmentScene(scaled)
  const cropW = box.maxX - box.minX + 1
  const cropH = box.maxY - box.minY + 1
  const labels = new Array(width * height).fill("")

  for (let y = 0; y < cropH; y++) {
    const sy = Math.min(scaled.height - 1, Math.floor((y * scaled.height) / cropH))
    for (let x = 0; x < cropW; x++) {
      const sx = Math.min(scaled.width - 1, Math.floor((x * scaled.width) / cropW))
      labels[(box.minY + y) * width + (box.minX + x)] =
        scaledLabels[sy * scaled.width + sx] || ""
    }
  }

  return { labels, box }
}

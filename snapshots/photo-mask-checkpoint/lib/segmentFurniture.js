"use client"

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

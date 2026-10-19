"use client"

const SAM_MODEL_ID = "Xenova/slimsam-77-uniform"

let samPromise = null
let embedCache = {
  key: "",
  image_embeddings: null,
  image_positional_embeddings: null,
  original_sizes: null,
  reshaped_input_sizes: null,
}

function imageKey(imageData) {
  const { width, height, data } = imageData
  let hash = width * 4099 + height
  const step = Math.max(1, Math.floor(data.length / 64))
  for (let i = 0; i < data.length; i += step) hash = (hash * 33 + data[i]) | 0
  return `${width}x${height}:${hash}`
}

function imageDataToRgb(imageData) {
  const { width, height, data } = imageData
  const rgb = new Uint8ClampedArray(width * height * 3)
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    rgb[j] = data[i]
    rgb[j + 1] = data[i + 1]
    rgb[j + 2] = data[i + 2]
  }
  return { rgb, width, height }
}

function extractPlane(data, offset, srcW, srcH, destWidth, destHeight) {
  const out = new Uint8Array(destWidth * destHeight)
  let on = 0
  let edge = 0
  for (let y = 0; y < destHeight; y++) {
    const sy = Math.min(srcH - 1, Math.floor((y * srcH) / destHeight))
    for (let x = 0; x < destWidth; x++) {
      const sx = Math.min(srcW - 1, Math.floor((x * srcW) / destWidth))
      const v = data[offset + sy * srcW + sx]
      if (!(v > 0.5)) continue
      const i = y * destWidth + x
      out[i] = 255
      on++
      if (
        x === 0 ||
        y === 0 ||
        x + 1 === destWidth ||
        y + 1 === destHeight ||
        !(data[offset + sy * srcW + Math.max(0, sx - 1)] > 0.5) ||
        !(data[offset + sy * srcW + Math.min(srcW - 1, sx + 1)] > 0.5)
      ) {
        edge++
      }
    }
  }
  return { out, on, skinny: on > 0 && edge / on > 0.5 }
}

function pickBestMask(tensor, scores, destWidth, destHeight) {
  const dims = tensor.dims || []
  const data = tensor.data
  if (!data || dims.length < 2) return null

  const nMasks = dims.length === 4 ? dims[1] : dims.length === 3 ? dims[0] : 1
  const height = dims[dims.length - 2]
  const width = dims[dims.length - 1]
  const plane = width * height
  const limit = Math.min(nMasks, scores?.length || nMasks)

  let best = null
  let bestScore = -1
  for (let i = 0; i < limit; i++) {
    const extracted = extractPlane(
      data,
      i * plane,
      width,
      height,
      destWidth,
      destHeight,
    )
    const coverage = extracted.on / extracted.out.length
    if (extracted.on < 40 || coverage > 0.62 || extracted.skinny) continue
    const iou = scores?.[i] ?? 0.5
    const score = iou * Math.log(1 + extracted.on)
    if (score > bestScore) {
      bestScore = score
      best = extracted.out
    }
  }
  return best
}

async function getSam() {
  if (typeof window === "undefined") {
    throw new Error("SAM is browser-only")
  }
  if (!samPromise) {
    samPromise = (async () => {
      const { SamModel, AutoProcessor, RawImage } = await import(
        "@huggingface/transformers"
      )
      const model = await SamModel.from_pretrained(SAM_MODEL_ID, { dtype: "q8" })
      const processor = await AutoProcessor.from_pretrained(SAM_MODEL_ID)
      return { model, processor, RawImage }
    })()
  }
  return samPromise
}

async function maskFromUrl(url, width, height) {
  const image = await new Promise((resolve, reject) => {
    const el = new Image()
    el.crossOrigin = "anonymous"
    el.onload = () => resolve(el)
    el.onerror = () => reject(new Error("마스크 이미지를 열지 못했습니다."))
    el.src = url
  })
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d")
  ctx.drawImage(image, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  const out = new Uint8Array(width * height)
  let on = 0
  for (let i = 0; i < out.length; i++) {
    const p = i * 4
    if (data[p] > 127 || data[p + 3] > 160) {
      out[i] = 255
      on++
    }
  }
  if (on < 24) throw new Error("empty replicate mask")
  return out
}

async function segmentViaReplicate(imageData, x, y, options = {}) {
  const canvas = document.createElement("canvas")
  canvas.width = imageData.width
  canvas.height = imageData.height
  canvas.getContext("2d").putImageData(imageData, 0, 0)
  const image = canvas.toDataURL("image/jpeg", 0.88)
  const res = await fetch("/api/segment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      image,
      x: Math.round(x),
      y: Math.round(y),
      width: imageData.width,
      height: imageData.height,
      subject: options.subject || "",
      targetId: options.targetId || "",
      targetIndex: options.targetIndex ?? 0,
    }),
  })
  if (!res.ok) throw new Error("replicate failed")
  const json = await res.json()
  if (!json.maskUrl) throw new Error("invalid replicate mask")
  return maskFromUrl(json.maskUrl, imageData.width, imageData.height)
}

export async function segmentObjectAtPoint(imageData, x, y, options = {}) {
  if (typeof window === "undefined") return null
  try {
    if (process.env.NEXT_PUBLIC_USE_REPLICATE === "1") {
      try {
        const mask = await segmentViaReplicate(imageData, x, y, options)
        if (mask) return mask
      } catch (error) {
        console.warn("replicate SAM failed, using in-browser SAM", error)
      }
    }

    const { model, processor, RawImage } = await getSam()
    const { rgb, width, height } = imageDataToRgb(imageData)
    const raw = new RawImage(rgb, width, height, 3)
    const px = Math.max(0, Math.min(width - 1, Math.round(x)))
    const py = Math.max(0, Math.min(height - 1, Math.round(y)))
    const input_points = [[[px, py]]]
    const inputs = await processor(raw, { input_points })
    const key = imageKey(imageData)

    if (embedCache.key !== key) {
      const embeddings = await model.get_image_embeddings({
        pixel_values: inputs.pixel_values,
      })
      embedCache = {
        key,
        image_embeddings: embeddings.image_embeddings,
        image_positional_embeddings: embeddings.image_positional_embeddings,
        original_sizes: inputs.original_sizes,
        reshaped_input_sizes: inputs.reshaped_input_sizes,
      }
    }

    const outputs = await model({
      ...inputs,
      image_embeddings: embedCache.image_embeddings,
      image_positional_embeddings: embedCache.image_positional_embeddings,
      input_points: inputs.input_points,
    })

    const masks = await processor.post_process_masks(
      outputs.pred_masks,
      embedCache.original_sizes || inputs.original_sizes,
      embedCache.reshaped_input_sizes || inputs.reshaped_input_sizes,
    )
    const scores = outputs.iou_scores?.data || outputs.iou_scores
    const tensor = Array.isArray(masks) ? masks[0] : masks
    return pickBestMask(tensor, scores, width, height)
  } catch (error) {
    console.warn("in-browser SAM failed", error)
    return null
  }
}

export function clearSamCache() {
  embedCache = {
    key: "",
    image_embeddings: null,
    image_positional_embeddings: null,
    original_sizes: null,
    reshaped_input_sizes: null,
  }
}

"use client"

const SAM_MODEL_ID = "Xenova/slimsam-77-uniform"

let samPromise = null
let embedToken = 0
let embedTask = null
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
  let fallback = null
  let fallbackScore = -1
  for (let i = 0; i < limit; i++) {
    const extracted = extractPlane(
      data,
      i * plane,
      width,
      height,
      destWidth,
      destHeight,
    )
    if (extracted.on < 40) continue
    const coverage = extracted.on / extracted.out.length
    const iou = Number(scores?.[i] ?? 0.5)
    const score = (Number.isFinite(iou) ? iou : 0.5) * Math.log(1 + extracted.on)
    if (score > fallbackScore) {
      fallbackScore = score
      fallback = extracted.out
    }
    if (coverage > 0.9 || extracted.skinny || score <= bestScore) continue
    bestScore = score
    best = extracted.out
  }
  return best || fallback
}

function normalizePrompts(points, width, height) {
  const list = Array.isArray(points) ? points : [points]
  const prompts = []
  for (const point of list) {
    const x = Array.isArray(point) ? point[0] : point?.x
    const y = Array.isArray(point) ? point[1] : point?.y
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    prompts.push({
      x: Math.max(0, Math.min(width - 1, Math.round(x))),
      y: Math.max(0, Math.min(height - 1, Math.round(y))),
      label: point?.label === 0 ? 0 : 1,
    })
  }
  return prompts
}

async function ensureEmbeddings(model, imageData, inputs) {
  const key = imageKey(imageData)
  if (embedCache.key === key && embedCache.image_embeddings) return embedCache
  const token = embedToken
  if (!embedTask || embedTask.key !== key || embedTask.token !== token) {
    embedTask = {
      key,
      token,
      promise: model
        .get_image_embeddings({ pixel_values: inputs.pixel_values })
        .then((embeddings) => {
          if (token !== embedToken) return null
          embedCache = {
            key,
            image_embeddings: embeddings.image_embeddings,
            image_positional_embeddings: embeddings.image_positional_embeddings,
            original_sizes: inputs.original_sizes,
            reshaped_input_sizes: inputs.reshaped_input_sizes,
          }
          return embedCache
        }),
    }
  }
  return embedTask.promise
}

async function getSam() {
  if (typeof window === "undefined") {
    throw new Error("SAM is browser-only")
  }
  if (!samPromise) {
    samPromise = (async () => {
      const ort = await import(
        /* webpackIgnore: true */ "/ort/ort.wasm.bundle.min.mjs"
      )
      const origin = window.location.origin
      if (ort.env?.wasm) {
        ort.env.wasm.wasmPaths = {
          wasm: `${origin}/ort/ort-wasm-simd-threaded.wasm`,
          mjs: `${origin}/ort/ort-wasm-simd-threaded.mjs`,
        }
        ort.env.wasm.numThreads = 1
        ort.env.wasm.proxy = false
      }
      globalThis[Symbol.for("onnxruntime")] = ort
      const { SamModel, AutoProcessor, RawImage, env } = await import(
        "@huggingface/transformers"
      )
      const wasm = env?.backends?.onnx?.wasm
      if (wasm) {
        wasm.wasmPaths = ort.env.wasm.wasmPaths
        wasm.numThreads = 1
        wasm.proxy = false
      }
      const model = await SamModel.from_pretrained(SAM_MODEL_ID, {
        dtype: "q8",
        device: "wasm",
      })
      const processor = await AutoProcessor.from_pretrained(SAM_MODEL_ID)
      return { model, processor, RawImage }
    })().catch((error) => {
      samPromise = null
      throw error
    })
  }
  return samPromise
}

export async function warmSegmentModel(imageData) {
  if (typeof window === "undefined" || !imageData) return
  const { model, processor, RawImage } = await getSam()
  const { rgb, width, height } = imageDataToRgb(imageData)
  const raw = new RawImage(rgb, width, height, 3)
  const inputs = await processor(raw)
  await ensureEmbeddings(model, imageData, inputs)
}

export async function segmentObjectAtPoints(imageData, points) {
  if (typeof window === "undefined") return null
  const { width, height } = imageData
  const prompts = normalizePrompts(points, width, height)
  if (!prompts.length) return null
  try {
    const { model, processor, RawImage } = await getSam()
    const { rgb } = imageDataToRgb(imageData)
    const raw = new RawImage(rgb, width, height, 3)
    const input_points = [[prompts.map((point) => [point.x, point.y])]]
    const input_labels = [prompts.map((point) => point.label)]
    const inputs = await processor(raw, { input_points, input_labels })
    const embedded = await ensureEmbeddings(model, imageData, inputs)
    if (!embedded?.image_embeddings) return null

    const outputs = await model({
      ...inputs,
      image_embeddings: embedded.image_embeddings,
      image_positional_embeddings: embedded.image_positional_embeddings,
      input_points: inputs.input_points,
      input_labels: inputs.input_labels,
    })

    const masks = await processor.post_process_masks(
      outputs.pred_masks,
      embedded.original_sizes || inputs.original_sizes,
      embedded.reshaped_input_sizes || inputs.reshaped_input_sizes,
    )
    const scores = outputs.iou_scores?.data || outputs.iou_scores
    const tensor = Array.isArray(masks) ? masks[0] : masks
    return pickBestMask(tensor, scores, width, height)
  } catch (error) {
    console.warn("in-browser SAM failed", error)
    return null
  }
}

export async function segmentObjectAtPoint(imageData, x, y, options = {}) {
  return segmentObjectAtPoints(imageData, [{ x, y, label: 1 }], options)
}

export function clearSamCache() {
  embedToken += 1
  embedTask = null
  embedCache = {
    key: "",
    image_embeddings: null,
    image_positional_embeddings: null,
    original_sizes: null,
    reshaped_input_sizes: null,
  }
}

export function luminanceBuffer(imageData) {
  const { data } = imageData
  const count = imageData.width * imageData.height
  const luma = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const p = i * 4
    luma[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) / 255
  }
  return luma
}

function blurHorizontal(src, width, height, radius) {
  const out = new Float32Array(src.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(width - 1, Math.max(0, x + k))
        sum += src[row + xx]
      }
      out[row + x] = sum / span
    }
  }
  return out
}

function blurVertical(src, width, height, radius) {
  const out = new Float32Array(src.length)
  const span = radius * 2 + 1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(height - 1, Math.max(0, y + k))
        sum += src[yy * width + x]
      }
      out[y * width + x] = sum / span
    }
  }
  return out
}

export function boxBlur(src, width, height, radius) {
  const r = Math.max(1, radius | 0)
  return blurVertical(blurHorizontal(src, width, height, r), width, height, r)
}

export function splitLuminance(luma, width, height, radius) {
  const mean = boxBlur(luma, width, height, radius)
  let sum = 0
  for (let i = 0; i < luma.length; i++) sum += luma[i]
  const imageMean = sum / Math.max(1, luma.length)
  const shade = new Uint8Array(luma.length)
  const highlight = new Uint8Array(luma.length)
  const detail = new Uint8Array(luma.length)
  for (let i = 0; i < luma.length; i++) {
    const value = luma[i]
    const around = Math.max(0.04, mean[i])
    const ratio = Math.max(0, Math.min(1.35, value / around))
    const occlusion = Math.max(0.22, Math.min(1, 0.42 + 0.58 * ratio))
    shade[i] = Math.round(occlusion * 255)
    const excess = Math.max(0, value - mean[i])
    highlight[i] = Math.round(Math.max(0, Math.min(1, excess * 2.6)) * 255)
    const broad = value - imageMean
    const local = value - mean[i]
    detail[i] = Math.max(16, Math.min(239, Math.round(128 + (broad * 2.4 + local * 0.55) * 255)))
  }
  return { shade, highlight, detail, mean }
}

export function blendPaintWithPhoto(albedo, shadeByte, detailByte, highlightByte) {
  const shade = shadeByte / 255
  let value = albedo * shade
  const detail = detailByte / 255
  value = detail < 0.5 ? 2 * value * detail : 1 - 2 * (1 - value) * (1 - detail)
  const highlight = Math.min(1, highlightByte / 255)
  return 1 - (1 - value) * (1 - highlight)
}

export function blendPreservingLight(albedo, shadeByte, highlightByte) {
  const shade = shadeByte / 255
  const highlight = highlightByte / 255
  const multiplied = albedo * shade
  return 1 - (1 - multiplied) * (1 - highlight)
}

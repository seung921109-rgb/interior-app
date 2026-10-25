import { clampByte } from "./color.js"

function luminanceAt(data, i) {
  const p = i * 4
  return 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
}

function blurLuma(lum, width, height) {
  const out = new Float32Array(lum.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let count = 0
      for (let dy = -1; dy <= 1; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          sum += lum[yy * width + xx]
          count++
        }
      }
      out[y * width + x] = sum / count
    }
  }
  return out
}

export function enhanceEdgesForSelection(imageData, amount = 0.72) {
  if (!imageData?.data) return imageData
  const { width, height, data } = imageData
  const n = width * height
  const lum = new Float32Array(n)
  for (let i = 0; i < n; i++) lum[i] = luminanceAt(data, i)
  const blurred = blurLuma(lum, width, height)
  const out = new ImageData(width, height)
  const dst = out.data
  for (let i = 0; i < n; i++) {
    const hp = lum[i] - blurred[i]
    const boosted = lum[i] + amount * hp + Math.sign(hp) * Math.min(16, Math.abs(hp) * 0.4)
    const scale = lum[i] > 1 ? boosted / lum[i] : 1
    const p = i * 4
    dst[p] = clampByte(data[p] * scale)
    dst[p + 1] = clampByte(data[p + 1] * scale)
    dst[p + 2] = clampByte(data[p + 2] * scale)
    dst[p + 3] = 255
  }
  return out
}

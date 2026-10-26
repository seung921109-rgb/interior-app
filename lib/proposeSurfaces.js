import { rgbToLab } from "@/lib/color"
import { countMaskOn, strictRegionFromPoint } from "@/lib/maskConstraint"
import { geometryFromMask, prepareDetections } from "@/lib/detection"

function buildLabs(imageData) {
  const n = imageData.width * imageData.height
  const L = new Float32Array(n)
  const A = new Float32Array(n)
  const B = new Float32Array(n)
  const { data } = imageData
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const lab = rgbToLab(data[p], data[p + 1], data[p + 2])
    L[i] = lab[0]
    A[i] = lab[1]
    B[i] = lab[2]
  }
  return { L, A, B }
}

function overlapRatio(next, existing) {
  let shared = 0
  let count = 0
  const n = Math.min(next.length, existing.length)
  for (let i = 0; i < n; i++) {
    if (next[i] < 24) continue
    count++
    if (existing[i] > 24) shared++
  }
  return count ? shared / count : 0
}

function describeSurface(mask, imageData) {
  const { width, height, data } = imageData
  let count = 0
  let ySum = 0
  let luma = 0
  let chroma = 0
  const step = Math.max(1, Math.floor(mask.length / 4000))
  for (let i = 0; i < mask.length; i += step) {
    if (mask[i] < 24) continue
    count++
    ySum += (i / width) | 0
    const p = i * 4
    const r = data[p]
    const g = data[p + 1]
    const b = data[p + 2]
    luma += 0.2126 * r + 0.7152 * g + 0.0722 * b
    chroma += Math.abs(r - g) + Math.abs(g - b)
  }
  if (!count) return { label: "사물", category: "object" }
  const y = ySum / count / height
  const tone = luma / count
  const color = chroma / count
  const box = geometryFromMask(mask, width, height).box
  const bh = box ? (box[2] - box[0]) / 1000 : 0
  const bw = box ? (box[3] - box[1]) / 1000 : 0
  if (bh > bw * 1.45 && bw < 0.42 && bw > 0.08 && tone > 150) {
    return { label: "창문", category: "window" }
  }
  if (bh > bw * 1.35 && bw < 0.5 && y > 0.18 && y < 0.82) {
    return { label: "문", category: "door" }
  }
  if (y > 0.72) return { label: "바닥", category: "floor" }
  if (tone > 185 && color < 26) return { label: "벽", category: "wall" }
  if (y > 0.42 && y < 0.68 && bh < 0.22 && color < 40) {
    return { label: "상판", category: "counter" }
  }
  if (color > 12 || (tone < 175 && y > 0.12 && y < 0.78)) {
    if (y < 0.42) return { label: "상부장", category: "cabinet" }
    if (y > 0.55) return { label: "하부장", category: "cabinet" }
    return { label: "수납장", category: "cabinet" }
  }
  return { label: "사물", category: "object" }
}

export function proposeSurfaces(imageData, labs = null) {
  const { width, height } = imageData
  const colorLabs = labs?.L ? labs : buildLabs(imageData)
  const seeds = [
    [0.5, 0.2],
    [0.5, 0.5],
    [0.18, 0.42],
    [0.82, 0.42],
    [0.5, 0.86],
    [0.28, 0.62],
    [0.72, 0.62],
  ]
  const found = []
  const occupied = new Uint8Array(width * height)
  const minCount = Math.round(width * height * 0.05)
  const maxCount = Math.round(width * height * 0.72)
  for (const [ux, uy] of seeds) {
    const mask = strictRegionFromPoint(
      imageData,
      colorLabs,
      Math.round(ux * (width - 1)),
      Math.round(uy * (height - 1)),
    )
    const count = countMaskOn(mask)
    if (count < minCount || count > maxCount) continue
    if (overlapRatio(mask, occupied) > 0.45) continue
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 24) occupied[i] = 255
    }
    const described = describeSurface(mask, imageData)
    const geometry = geometryFromMask(mask, width, height)
    found.push({
      id: `surface-${found.length + 1}`,
      label: described.label,
      category: described.category,
      box: geometry.box,
      polygon: geometry.polygon,
      mask,
    })
  }
  return prepareDetections(found, width, height)
}

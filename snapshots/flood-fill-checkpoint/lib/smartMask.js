import { labelGroup } from "@/lib/adeClasses"
import { labDist, luminance, rgbToLab } from "@/lib/color"
import {
  cloneMask,
  feather,
  fillHolesInRegion,
  morphClose,
  morphOpen,
} from "@/lib/mask"

export function buildLabBuffer(imageData) {
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

function labAt(labs, i) {
  return [labs.L[i], labs.A[i], labs.B[i]]
}

export function majorityLabel(labels, mask) {
  const counts = new Map()
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] <= 128) continue
    const label = labels[i]
    if (!label) continue
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  let best = ""
  let bestCount = 0
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label
      bestCount = count
    }
  }
  return best
}

export function connectedLabelMask(labels, seedMask, width, height, allowed) {
  const out = new Uint8Array(seedMask.length)
  const seen = new Uint8Array(seedMask.length)
  const queue = new Int32Array(seedMask.length)
  let head = 0
  let tail = 0

  for (let i = 0; i < seedMask.length; i++) {
    if (seedMask[i] <= 128) continue
    const label = labels[i]
    if (allowed && label && !allowed.has(label)) continue
    if (!label && allowed) continue
    out[i] = 255
    seen[i] = 1
    queue[tail++] = i
  }

  while (head < tail) {
    const idx = queue[head++]
    const seedLabel = labels[idx]
    const x = idx % width
    const y = (idx / width) | 0
    const neighbors = [idx - 1, idx + 1, idx - width, idx + width]
    const valid = [x > 0, x + 1 < width, y > 0, y + 1 < height]
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue
      const n = neighbors[k]
      if (seen[n]) continue
      const nextLabel = labels[n]
      if (seedLabel && nextLabel && nextLabel !== seedLabel) continue
      if (allowed && nextLabel && !allowed.has(nextLabel)) continue
      if (allowed && seedLabel && !nextLabel) continue
      seen[n] = 1
      out[n] = 255
      queue[tail++] = n
    }
  }
  return out
}

export function borderBackgroundMask(labs, width, height) {
  const bg = new Uint8Array(labs.L.length)
  const seen = new Uint8Array(bg.length)
  const queue = new Int32Array(bg.length)
  let head = 0
  let tail = 0
  const seed = (idx) => {
    if (seen[idx]) return
    if (labs.L[idx] < 62 && Math.abs(labs.A[idx]) + Math.abs(labs.B[idx]) > 18) return
    seen[idx] = 1
    bg[idx] = 1
    queue[tail++] = idx
  }
  for (let x = 0; x < width; x++) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    seed(y * width)
    seed(y * width + width - 1)
  }
  while (head < tail) {
    const idx = queue[head++]
    const x = idx % width
    const y = (idx / width) | 0
    const neighbors = [idx - 1, idx + 1, idx - width, idx + width]
    const valid = [x > 0, x + 1 < width, y > 0, y + 1 < height]
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue
      const n = neighbors[k]
      if (seen[n]) continue
      if (labDist(labAt(labs, n), labAt(labs, idx)) > 10) continue
      if (labs.L[n] < 58 && Math.abs(labs.A[n]) + Math.abs(labs.B[n]) > 22) continue
      seen[n] = 1
      bg[n] = 1
      queue[tail++] = n
    }
  }
  return bg
}

export function sobelMagnitude(imageData) {
  const { width, height, data } = imageData
  const mag = new Float32Array(width * height)
  const lum = new Float32Array(width * height)
  for (let i = 0; i < lum.length; i++) {
    const p = i * 4
    lum[i] = luminance(data[p], data[p + 1], data[p + 2])
  }
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const gx =
        -lum[i - width - 1] +
        lum[i - width + 1] -
        2 * lum[i - 1] +
        2 * lum[i + 1] -
        lum[i + width - 1] +
        lum[i + width + 1]
      const gy =
        -lum[i - width - 1] -
        2 * lum[i - width] -
        lum[i - width + 1] +
        lum[i + width - 1] +
        2 * lum[i + width] +
        lum[i + width + 1]
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return mag
}

export function sampleSeedLab(labs, width, height, x, y) {
  let sL = 0
  let sA = 0
  let sB = 0
  let n = 0
  const x0 = Math.max(0, Math.round(x) - 1)
  const x1 = Math.min(width - 1, Math.round(x) + 1)
  const y0 = Math.max(0, Math.round(y) - 1)
  const y1 = Math.min(height - 1, Math.round(y) + 1)
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * width + xx
      sL += labs.L[i]
      sA += labs.A[i]
      sB += labs.B[i]
      n++
    }
  }
  return [sL / n, sA / n, sB / n]
}

export function floodFill(
  labs,
  width,
  height,
  sx,
  sy,
  tolerance = 28,
  { background = null, labels = null, blockedLabels = null } = {},
) {
  const x0 = Math.max(0, Math.min(width - 1, Math.round(sx)))
  const y0 = Math.max(0, Math.min(height - 1, Math.round(sy)))
  return floodFillFromSeeds(
    labs,
    width,
    height,
    [y0 * width + x0],
    sampleSeedLab(labs, width, height, x0, y0),
    tolerance,
    { background, labels, blockedLabels },
  )
}

export function floodFillFromSeeds(
  labs,
  width,
  height,
  seedIndexes,
  seedLab,
  tolerance = 28,
  { background = null, labels = null, blockedLabels = null } = {},
) {
  const mask = new Uint8Array(width * height)
  const seen = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0

  for (const idx of seedIndexes) {
    if (idx < 0 || idx >= mask.length || seen[idx]) continue
    seen[idx] = 1
    queue[tail++] = idx
  }

  while (head < tail) {
    const idx = queue[head++]
    if (labDist(labAt(labs, idx), seedLab) > tolerance) continue
    if (background && background[idx] && labDist(labAt(labs, idx), seedLab) > tolerance * 0.7) {
      continue
    }
    if (blockedLabels && labels) {
      const label = labels[idx]
      if (label && blockedLabels.has(label)) continue
    }
    mask[idx] = 255
    const x = idx % width
    const y = (idx / width) | 0
    const neighbors = [
      idx - 1,
      idx + 1,
      idx - width,
      idx + width,
      idx - width - 1,
      idx - width + 1,
      idx + width - 1,
      idx + width + 1,
    ]
    const valid = [
      x > 0,
      x + 1 < width,
      y > 0,
      y + 1 < height,
      x > 0 && y > 0,
      x + 1 < width && y > 0,
      x > 0 && y + 1 < height,
      x + 1 < width && y + 1 < height,
    ]
    for (let k = 0; k < 8; k++) {
      if (!valid[k]) continue
      const n = neighbors[k]
      if (seen[n]) continue
      seen[n] = 1
      queue[tail++] = n
    }
  }
  return mask
}

export function growFromMask(
  labs,
  mask,
  width,
  height,
  {
    tolerance = 28,
    labels = null,
    blockedLabels = null,
    background = null,
  } = {},
) {
  const seedIndexes = []
  let sL = 0
  let sA = 0
  let sB = 0
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] <= 128) continue
    seedIndexes.push(i)
    sL += labs.L[i]
    sA += labs.A[i]
    sB += labs.B[i]
    count++
  }
  if (!count) return cloneMask(mask)
  const filled = floodFillFromSeeds(
    labs,
    width,
    height,
    seedIndexes,
    [sL / count, sA / count, sB / count],
    tolerance,
    { background, labels, blockedLabels },
  )
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > filled[i]) filled[i] = mask[i]
  }
  return filled
}

export function snapMaskToEdges(imageData, labs, mask, radius = 4) {
  const { width, height } = imageData
  const mag = sobelMagnitude(imageData)
  const next = cloneMask(mask)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      const on = mask[i] > 128
      const boundary =
        (mask[i - 1] > 128) !== on ||
        (mask[i + 1] > 128) !== on ||
        (mask[i - width] > 128) !== on ||
        (mask[i + width] > 128) !== on
      if (!boundary) continue

      let best = mag[i]
      let bestIndex = i
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          const yy = y + dy
          if (xx < 0 || yy < 0 || xx >= width || yy >= height) continue
          const ni = yy * width + xx
          if (mag[ni] > best) {
            best = mag[ni]
            bestIndex = ni
          }
        }
      }

      if (bestIndex === i || best < mag[i] + 10) continue
      if (labDist(labAt(labs, bestIndex), labAt(labs, i)) > 16) continue
      next[bestIndex] = 255
      if (on && mag[i] < best * 0.4) next[i] = 0
    }
  }
  return next
}

export function snapToClassBoundary(mask, classGuide, width, height) {
  if (!classGuide) return mask
  const next = cloneMask(mask)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      if (classGuide[i] < 128) {
        next[i] = Math.min(next[i], 24)
        continue
      }
      if (mask[i] > 80) next[i] = Math.max(next[i], 220)
    }
  }
  return next
}

export function smartFillFromMask(imageData, labs, mask, options = {}) {
  const { width, height } = imageData
  const labels = options.labels || null
  let seedLabel = labels ? majorityLabel(labels, mask) : ""
  let seedGroup = labelGroup(seedLabel)
  const background = borderBackgroundMask(labs, width, height)

  let seedCount = 0
  let seedBg = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] <= 128) continue
    seedCount++
    if (background[i]) seedBg++
  }
  const paintedBackground = seedCount > 0 && seedBg / seedCount > 0.55
  if (seedGroup === "scene" && !paintedBackground) {
    seedGroup = "furniture"
  }

  const blockedLabels =
    seedGroup === "furniture" ? new Set(["wall", "floor", "ceiling", "sky"]) : null

  const grown = growFromMask(labs, mask, width, height, {
    tolerance: 28,
    labels,
    blockedLabels,
    background: paintedBackground ? null : background,
  })

  const allowed = dilateRegion(grown, width, height, 8)
  fillHolesInRegion(grown, allowed, width, height)

  const displayLabel =
    seedGroup === "furniture" && labelGroup(seedLabel) !== "furniture"
      ? "furniture"
      : seedLabel
  return { mask: grown, seedLabel: displayLabel, seedGroup }
}

function dilateRegion(mask, width, height, radius) {
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] < 128) continue
      const x0 = Math.max(0, x - radius)
      const x1 = Math.min(width - 1, x + radius)
      const y0 = Math.max(0, y - radius)
      const y1 = Math.min(height - 1, y + radius)
      for (let yy = y0; yy <= y1; yy++) {
        for (let xx = x0; xx <= x1; xx++) out[yy * width + xx] = 255
      }
    }
  }
  return out
}

export function smoothMask(mask, width, height) {
  let next = morphClose(mask, width, height, 3)
  next = morphOpen(next, width, height, 1)
  feather(next, width, height, 2)
  for (let i = 0; i < next.length; i++) {
    if (next[i] >= 96) next[i] = 255
    else if (next[i] <= 48) next[i] = 0
  }
  feather(next, width, height, 1)
  return next
}

export function refineSelection(imageData, labs, mask, classGuide = null) {
  const { width, height } = imageData
  let next = smoothMask(mask, width, height)
  next = snapMaskToEdges(imageData, labs, next, 3)
  next = snapToClassBoundary(next, classGuide, width, height)
  next = morphClose(next, width, height, 1)
  feather(next, width, height, 1)
  return next
}

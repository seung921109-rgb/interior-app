import { FURNITURE_LABELS, labelGroup } from "@/lib/adeClasses"
import { labDist, luminance, rgbToLab } from "@/lib/color"
import {
  cloneMask,
  erode,
  fillHoles,
  morphClose,
  unionMask,
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

export function sobelField(imageData) {
  const { width, height, data } = imageData
  const mag = new Float32Array(width * height)
  const gxOut = new Float32Array(width * height)
  const gyOut = new Float32Array(width * height)
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
      gxOut[i] = gx
      gyOut[i] = gy
      mag[i] = Math.hypot(gx, gy)
    }
  }
  return { mag, gx: gxOut, gy: gyOut }
}

export function sobelMagnitude(imageData) {
  return sobelField(imageData).mag
}

export function sampleSeedLab(labs, width, height, x, y, mag = null) {
  const samples = []
  const x0 = Math.max(0, Math.round(x) - 2)
  const x1 = Math.min(width - 1, Math.round(x) + 2)
  const y0 = Math.max(0, Math.round(y) - 2)
  const y1 = Math.min(height - 1, Math.round(y) + 2)
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * width + xx
      samples.push({
        i,
        mag: mag ? mag[i] : 0,
        L: labs.L[i],
        A: labs.A[i],
        B: labs.B[i],
      })
    }
  }
  samples.sort((a, b) => a.mag - b.mag)
  const take = samples.slice(0, Math.max(4, Math.ceil(samples.length * 0.45)))
  let sL = 0
  let sA = 0
  let sB = 0
  for (const s of take) {
    sL += s.L
    sA += s.A
    sB += s.B
  }
  return [sL / take.length, sA / take.length, sB / take.length]
}

function colorCost(labs, idx, seedLab, background = null) {
  const dL = labs.L[idx] - seedLab[0]
  const dA = labs.A[idx] - seedLab[1]
  const dB = labs.B[idx] - seedLab[2]
  const full = Math.hypot(dL, dA, dB)
  if (background && background[idx]) return full
  const chroma = Math.hypot(dA, dB)
  if (chroma < 8 && dL > 0 && dL < 12) return chroma + dL * 0.55
  return full
}

function crossesHardEdge(edgeMag, labs, from, to, seedLab, background = null) {
  if (!edgeMag) return false
  const magTo = edgeMag[to]
  if (background && background[to] && magTo >= 22) return true
  if (labs.L[to] > labs.L[from] + 4 && magTo >= 32) return true
  if (magTo < 56) return false
  const dTo = colorCost(labs, to, seedLab, background)
  const dFrom = colorCost(labs, from, seedLab, background)
  if (magTo >= 72 && dTo > dFrom + 4 && dTo > 12) return true
  if (magTo >= 56 && dTo > 18) return true
  return false
}

export function floodFill(
  labs,
  width,
  height,
  sx,
  sy,
  tolerance = 24,
  { background = null, labels = null, blockedLabels = null, edgeMag = null } = {},
) {
  const x0 = Math.max(0, Math.min(width - 1, Math.round(sx)))
  const y0 = Math.max(0, Math.min(height - 1, Math.round(sy)))
  return floodFillFromSeeds(
    labs,
    width,
    height,
    [y0 * width + x0],
    sampleSeedLab(labs, width, height, x0, y0, edgeMag),
    tolerance,
    { background, labels, blockedLabels, edgeMag },
  )
}

export function floodFillFromSeeds(
  labs,
  width,
  height,
  seedIndexes,
  seedLab,
  tolerance = 24,
  { background = null, labels = null, blockedLabels = null, edgeMag = null } = {},
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
    const dist = colorCost(labs, idx, seedLab, background)
    if (dist > tolerance) continue
    if (background && background[idx] && dist > 7) {
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
      if (k < 4 && crossesHardEdge(edgeMag, labs, idx, n, seedLab, background)) continue
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
    tolerance = 24,
    labels = null,
    blockedLabels = null,
    background = null,
    edgeMag = null,
  } = {},
) {
  const interior = erode(mask, width, height, 2)
  const seedIndexes = []
  let sL = 0
  let sA = 0
  let sB = 0
  let count = 0
  const source = interior
  for (let i = 0; i < source.length; i++) {
    if (source[i] <= 180) continue
    seedIndexes.push(i)
    sL += labs.L[i]
    sA += labs.A[i]
    sB += labs.B[i]
    count++
  }
  if (!count) {
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] <= 128) continue
      seedIndexes.push(i)
      sL += labs.L[i]
      sA += labs.A[i]
      sB += labs.B[i]
      count++
    }
  }
  if (!count) return cloneMask(mask)
  const filled = floodFillFromSeeds(
    labs,
    width,
    height,
    seedIndexes,
    [sL / count, sA / count, sB / count],
    tolerance,
    { background, labels, blockedLabels, edgeMag },
  )
  return unionMask(mask, filled)
}

function maskCentroid(mask, width) {
  let sx = 0
  let sy = 0
  let n = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] <= 128) continue
    sx += i % width
    sy += (i / width) | 0
    n++
  }
  if (!n) return { x: 0, y: 0, n: 0 }
  return { x: sx / n, y: sy / n, n }
}

function interiorLab(labs, mask, skip = null) {
  let sL = 0
  let sA = 0
  let sB = 0
  let n = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 200) continue
    if (skip && skip[i]) continue
    sL += labs.L[i]
    sA += labs.A[i]
    sB += labs.B[i]
    n++
  }
  if (!n) return null
  return [sL / n, sA / n, sB / n]
}

function meanLabOf(labs, pick) {
  let sL = 0
  let sA = 0
  let sB = 0
  let n = 0
  for (let i = 0; i < pick.length; i++) {
    if (!pick[i]) continue
    sL += labs.L[i]
    sA += labs.A[i]
    sB += labs.B[i]
    n++
  }
  if (!n) return null
  return [sL / n, sA / n, sB / n]
}

export function cutBackgroundBleed(labs, mask, background) {
  if (!background) return mask
  const wall = meanLabOf(labs, background)
  const object = interiorLab(labs, mask, background) || interiorLab(labs, mask)
  if (!wall || !object) return mask
  const next = cloneMask(mask)
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] <= 128 || !background[i]) continue
    const darkerWood = labs.L[i] < wall[0] - 7
    const moreChroma =
      Math.abs(labs.A[i]) + Math.abs(labs.B[i]) >
      Math.abs(wall[1]) + Math.abs(wall[2]) + 10
    if (darkerWood || moreChroma) continue
    const dWall = labDist(labAt(labs, i), wall)
    const dObj = labDist(labAt(labs, i), object)
    if (dWall <= dObj + 3) next[i] = 0
  }
  return next
}

export function clipAtObjectWallEdge(imageData, labs, mask, background) {
  const { width, height } = imageData
  const mag = sobelMagnitude(imageData)
  const wall = background ? meanLabOf(labs, background) : null
  const object = interiorLab(labs, mask, background) || interiorLab(labs, mask)
  if (!object) return mask
  const { x: cx, y: cy, n } = maskCentroid(mask, width)
  if (!n) return mask

  const next = cloneMask(mask)
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      if (mask[i] <= 128) continue
      const vx = x - cx
      const vy = y - cy
      const dist = Math.hypot(vx, vy)
      if (dist < 6) continue
      const nx = vx / dist
      const ny = vy / dist

      let peakT = 0
      let peakMag = 0
      const limit = dist + 2
      for (let t = 4; t <= limit; t++) {
        const xx = Math.round(cx + nx * t)
        const yy = Math.round(cy + ny * t)
        if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) break
        const ni = yy * width + xx
        const inward = Math.round(cx + nx * (t - 2))
        const inwardY = Math.round(cy + ny * (t - 2))
        const outward = Math.round(cx + nx * (t + 2))
        const outwardY = Math.round(cy + ny * (t + 2))
        if (
          inward < 0 ||
          inwardY < 0 ||
          outward < 0 ||
          outwardY < 0 ||
          inward >= width ||
          outward >= width ||
          inwardY >= height ||
          outwardY >= height
        ) {
          continue
        }
        const ii = inwardY * width + inward
        const oi = outwardY * width + outward
        const dIn = labDist(labAt(labs, ii), object)
        const dOut = labDist(labAt(labs, oi), object)
        const wallOut = wall ? labDist(labAt(labs, oi), wall) : 999
        const wallIn = wall ? labDist(labAt(labs, ii), wall) : 999
        const leavesObject = dOut > dIn + 3 && wallOut + 1 < wallIn
        if (mag[ni] > 20 && leavesObject && mag[ni] >= peakMag) {
          peakMag = mag[ni]
          peakT = t
        }
      }
      if (peakT > 0 && dist > peakT + 1.25) next[i] = 0
    }
  }
  return next
}

export function snapContourToRidge(imageData, labs, mask, radius = 5) {
  const { width, height } = imageData
  const { mag, gx, gy } = sobelField(imageData)
  const next = cloneMask(mask)
  const { x: cx, y: cy, n } = maskCentroid(mask, width)
  if (!n) return next
  const mean = interiorLab(labs, mask)

  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      const i = y * width + x
      const on = mask[i] > 128
      const boundary =
        (mask[i - 1] > 128) !== on ||
        (mask[i + 1] > 128) !== on ||
        (mask[i - width] > 128) !== on ||
        (mask[i + width] > 128) !== on
      if (!boundary) continue

      const g = mag[i] || 1
      let nx = gx[i] / g
      let ny = gy[i] / g
      if (!Number.isFinite(nx) || !Number.isFinite(ny) || g < 6) {
        nx = cx - x
        ny = cy - y
        const len = Math.hypot(nx, ny) || 1
        nx /= len
        ny /= len
      }

      let bestT = 0
      let bestMag = mag[i]
      for (let t = -radius; t <= radius; t++) {
        const xx = Math.round(x + nx * t)
        const yy = Math.round(y + ny * t)
        if (xx < 1 || yy < 1 || xx >= width - 1 || yy >= height - 1) continue
        const ni = yy * width + xx
        if (mag[ni] > bestMag) {
          bestMag = mag[ni]
          bestT = t
        }
      }
      if (bestMag < mag[i] + 6) continue

      const bx = Math.round(x + nx * bestT)
      const by = Math.round(y + ny * bestT)
      const towardCenter = (cx - x) * (bx - x) + (cy - y) * (by - y)

      if (on && towardCenter > 0 && bestMag > mag[i] + 14) {
        if (mean && colorCost(labs, i, mean) > 16) next[i] = 0
        const ei = by * width + bx
        if (mean && colorCost(labs, ei, mean) < 18) next[ei] = 255
      } else if (!on && towardCenter < 0 && bestMag > 22) {
        if (!mean || colorCost(labs, i, mean) < 18) next[i] = 255
      }
    }
  }
  return next
}

export function peelHalo(imageData, labs, mask, labels, background) {
  const { width, height } = imageData
  const mag = sobelMagnitude(imageData)
  const mean = interiorLab(labs, mask)
  if (!mean) return mask
  const next = cloneMask(mask)
  const { x: cx, y: cy } = maskCentroid(mask, width)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const i = y * width + x
      if (mask[i] <= 128) continue
      const edge =
        mask[i - 1] <= 128 ||
        mask[i + 1] <= 128 ||
        mask[i - width] <= 128 ||
        mask[i + width] <= 128
      if (!edge) continue

      const dist = labDist(labAt(labs, i), mean)
      const wallish =
        (labels && (labels[i] === "wall" || labels[i] === "ceiling" || labels[i] === "floor")) ||
        (background && background[i])
      const brighterThanObject = labs.L[i] > mean[0] + 8
      const towardCenterX = cx - x
      const towardCenterY = cy - y

      let ridgeTowardInside = false
      let best = mag[i]
      for (let dy = -3; dy <= 3; dy++) {
        for (let dx = -3; dx <= 3; dx++) {
          const ni = (y + dy) * width + (x + dx)
          if (ni < 0 || ni >= mag.length) continue
          if (mag[ni] <= best) continue
          best = mag[ni]
          if (dx * towardCenterX + dy * towardCenterY > 0) ridgeTowardInside = true
        }
      }

      if (ridgeTowardInside && best > mag[i] + 14 && wallish && dist > 16) {
        next[i] = 0
      } else if (wallish && dist > 22 && brighterThanObject) {
        next[i] = 0
      }
    }
  }
  return next
}

export function snapMaskToEdges(imageData, labs, mask, radius = 4) {
  return snapContourToRidge(imageData, labs, mask, radius)
}

export function snapToClassBoundary(mask, classGuide, width, height) {
  if (!classGuide) return mask
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
      if (on && classGuide[i] < 80) next[i] = Math.min(next[i], 20)
      if (!on && classGuide[i] > 180 && (mask[i - 1] > 128 || mask[i + 1] > 128 || mask[i - width] > 128 || mask[i + width] > 128)) {
        next[i] = Math.max(next[i], 220)
      }
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
  const edgeMag = sobelMagnitude(imageData)

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

  const furnitureKnown = FURNITURE_LABELS.has(seedLabel)
  const blockedLabels =
    seedGroup === "furniture" && furnitureKnown
      ? new Set(["wall", "floor", "ceiling", "sky"])
      : null

  const bgMask = paintedBackground ? null : background
  const grown = growFromMask(labs, mask, width, height, {
    tolerance: 26,
    labels,
    blockedLabels,
    background: bgMask,
    edgeMag,
  })

  let sealed = cutBackgroundBleed(labs, grown, bgMask)
  sealed = clipAtObjectWallEdge(imageData, labs, sealed, bgMask)
  fillHoles(sealed, width, height)
  sealed = morphClose(sealed, width, height, 1)
  fillHoles(sealed, width, height)

  const displayLabel =
    seedGroup === "furniture" && labelGroup(seedLabel) !== "furniture"
      ? "furniture"
      : seedLabel
  return { mask: sealed, seedLabel: displayLabel, seedGroup, paintedBackground }
}

export function expandFromPaint(imageData, labs, mask, paint, options = {}) {
  const { width, height } = imageData
  const combined = paint ? unionMask(mask, paint) : cloneMask(mask)
  const seeds = []
  const source = paint && paint.length === mask.length ? paint : mask
  for (let i = 0; i < source.length; i++) {
    if (source[i] > 180) seeds.push(i)
  }
  if (!seeds.length) {
    fillHoles(combined, width, height)
    return combined
  }
  let sL = 0
  let sA = 0
  let sB = 0
  for (const i of seeds) {
    sL += labs.L[i]
    sA += labs.A[i]
    sB += labs.B[i]
  }
  const extra = floodFillFromSeeds(
    labs,
    width,
    height,
    seeds,
    [sL / seeds.length, sA / seeds.length, sB / seeds.length],
    30,
    {
      background: options.background || null,
      labels: options.labels || null,
      blockedLabels: options.blockedLabels || null,
      edgeMag: options.edgeMag || sobelMagnitude(imageData),
    },
  )
  const out = unionMask(combined, extra)
  fillHoles(out, width, height)
  return morphClose(out, width, height, 1)
}

export function smoothMask(mask, width, height) {
  const next = morphClose(mask, width, height, 2)
  fillHoles(next, width, height)
  return next
}

export function refineSelection(
  imageData,
  labs,
  mask,
  classGuide = null,
  { labels = null, background = null, preserve = null } = {},
) {
  const { width, height } = imageData
  const bg = background || borderBackgroundMask(labs, width, height)
  let next = cutBackgroundBleed(labs, mask, bg)
  next = clipAtObjectWallEdge(imageData, labs, next, bg)
  fillHoles(next, width, height)
  next = snapContourToRidge(imageData, labs, next, 3)
  next = peelHalo(imageData, labs, next, labels, bg)
  next = snapToClassBoundary(next, classGuide, width, height)
  next = morphClose(next, width, height, 1)
  fillHoles(next, width, height)
  if (preserve) next = unionMask(next, preserve)
  fillHoles(next, width, height)
  return next
}

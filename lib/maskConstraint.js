export const SEED_COLOR_LIMIT = 17
export const SEED_LUMA_LIMIT = 15

function sobelMagnitude(imageData) {
  const { width, height, data } = imageData
  const n = width * height
  const lum = new Float32Array(n)
  const mag = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    lum[i] = 0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]
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

function sampleSeedLab(labs, width, height, x, y, mag) {
  const samples = []
  const x0 = Math.max(0, x - 2)
  const x1 = Math.min(width - 1, x + 2)
  const y0 = Math.max(0, y - 2)
  const y1 = Math.min(height - 1, y + 2)
  for (let yy = y0; yy <= y1; yy++) {
    for (let xx = x0; xx <= x1; xx++) {
      const i = yy * width + xx
      samples.push({
        mag: mag[i] || 0,
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
  for (const sample of take) {
    sL += sample.L
    sA += sample.A
    sB += sample.B
  }
  return [sL / take.length, sA / take.length, sB / take.length]
}

function isFrameBarrier(labs, mag, idx, seedLab) {
  const darker = seedLab[0] - labs.L[idx]
  const edge = mag[idx] || 0
  if (darker >= 18) return true
  if (darker >= 9 && edge >= 16) return true
  if (edge >= 84) return true
  return false
}

function similarToSeed(labs, mag, idx, seedLab, colorLimit, lumaLimit) {
  const dL = Math.abs(labs.L[idx] - seedLab[0])
  const dist = Math.hypot(
    labs.L[idx] - seedLab[0],
    labs.A[idx] - seedLab[1],
    labs.B[idx] - seedLab[2],
  )
  const edge = mag[idx] || 0
  const tight = edge >= 16
  if (dist > (tight ? Math.min(9, colorLimit) : colorLimit)) return false
  if (dL > (tight ? Math.min(7, lumaLimit) : lumaLimit)) return false
  return true
}

export function strictRegionFromPoint(imageData, labs, x, y, options = {}) {
  const { width, height } = imageData
  const mag = options.edgeMag || sobelMagnitude(imageData)
  const x0 = Math.max(0, Math.min(width - 1, Math.round(x)))
  const y0 = Math.max(0, Math.min(height - 1, Math.round(y)))
  const seedLab = sampleSeedLab(labs, width, height, x0, y0, mag)
  const colorLimit = options.colorLimit ?? SEED_COLOR_LIMIT
  const lumaLimit = options.lumaLimit ?? SEED_LUMA_LIMIT
  const mask = new Uint8Array(width * height)
  const seen = new Uint8Array(width * height)
  const queue = new Int32Array(width * height)
  let head = 0
  let tail = 0
  const start = y0 * width + x0
  seen[start] = 1
  queue[tail++] = start

  while (head < tail) {
    const idx = queue[head++]
    if (idx !== start && (isFrameBarrier(labs, mag, idx, seedLab) || !similarToSeed(labs, mag, idx, seedLab, colorLimit, lumaLimit))) {
      continue
    }
    mask[idx] = 255
    const px = idx % width
    const py = (idx / width) | 0
    const neighbors = [idx - 1, idx + 1, idx - width, idx + width]
    const valid = [px > 0, px + 1 < width, py > 0, py + 1 < height]
    for (let k = 0; k < 4; k++) {
      if (!valid[k]) continue
      const next = neighbors[k]
      if (seen[next]) continue
      seen[next] = 1
      if (isFrameBarrier(labs, mag, next, seedLab)) continue
      queue[tail++] = next
    }
  }

  fillSmallHoles(mask, width, height)
  return mask
}

function fillSmallHoles(mask, width, height) {
  const maxArea = Math.max(120, Math.round(width * height * 0.015))
  const seen = new Uint8Array(mask.length)
  const stack = []
  const markBorder = (idx) => {
    if (seen[idx] || mask[idx] > 80) return
    seen[idx] = 1
    stack.push(idx)
  }
  for (let x = 0; x < width; x++) {
    markBorder(x)
    markBorder((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    markBorder(y * width)
    markBorder(y * width + width - 1)
  }
  while (stack.length) {
    const idx = stack.pop()
    const x = idx % width
    const y = (idx / width) | 0
    const nbs = [idx - 1, idx + 1, idx - width, idx + width]
    const ok = [x > 0, x + 1 < width, y > 0, y + 1 < height]
    for (let k = 0; k < 4; k++) {
      if (!ok[k] || seen[nbs[k]] || mask[nbs[k]] > 80) continue
      seen[nbs[k]] = 1
      stack.push(nbs[k])
    }
  }
  const component = []
  for (let i = 0; i < mask.length; i++) {
    if (seen[i] || mask[i] > 80) continue
    component.length = 0
    seen[i] = 1
    stack.push(i)
    while (stack.length) {
      const idx = stack.pop()
      component.push(idx)
      const x = idx % width
      const y = (idx / width) | 0
      const nbs = [idx - 1, idx + 1, idx - width, idx + width]
      const ok = [x > 0, x + 1 < width, y > 0, y + 1 < height]
      for (let k = 0; k < 4; k++) {
        if (!ok[k] || seen[nbs[k]] || mask[nbs[k]] > 80) continue
        seen[nbs[k]] = 1
        stack.push(nbs[k])
      }
    }
    if (component.length > maxArea) continue
    for (const idx of component) mask[idx] = 255
  }
}

export function intersectMasks(a, b) {
  const n = Math.min(a.length, b.length)
  const out = new Uint8Array(Math.max(a.length, b.length))
  for (let i = 0; i < n; i++) {
    if (a[i] > 24 && b[i] > 24) out[i] = 255
  }
  return out
}

export function bridgeInteriorGaps(mask, width, height, radius = 3) {
  const out = new Uint8Array(mask)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x
      if (mask[i] > 24) continue
      let left = false
      let right = false
      let up = false
      let down = false
      for (let d = 1; d <= radius; d++) {
        if (x - d >= 0 && mask[i - d] > 24) left = true
        if (x + d < width && mask[i + d] > 24) right = true
        if (y - d >= 0 && mask[i - d * width] > 24) up = true
        if (y + d < height && mask[i + d * width] > 24) down = true
      }
      if ((left && right) || (up && down)) out[i] = 255
    }
  }
  return out
}

export function countMaskOn(mask, min = 24) {
  let n = 0
  for (let i = 0; i < mask.length; i++) if (mask[i] > min) n++
  return n
}

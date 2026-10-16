export const BRUSH_RADIUS = 22

export function emptyMask(length) {
  return new Uint8Array(length)
}

export function cloneMask(mask) {
  return new Uint8Array(mask)
}

export function unionMask(a, b) {
  const out = new Uint8Array(a.length)
  for (let i = 0; i < a.length; i++) out[i] = a[i] > b[i] ? a[i] : b[i]
  return out
}

export function maskHasSelection(mask) {
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 24) return true
  }
  return false
}

export function stampBrush(mask, width, height, cx, cy, radius, value = 255) {
  const r2 = radius * radius
  const x0 = Math.max(0, Math.floor(cx - radius))
  const x1 = Math.min(width - 1, Math.ceil(cx + radius))
  const y0 = Math.max(0, Math.floor(cy - radius))
  const y1 = Math.min(height - 1, Math.ceil(cy + radius))
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const dx = x - cx
      const dy = y - cy
      if (dx * dx + dy * dy <= r2) mask[y * width + x] = value
    }
  }
}

export function stampBrushSegment(mask, width, height, from, to, radius, value = 255) {
  if (!from) {
    stampBrush(mask, width, height, to.x, to.y, radius, value)
    return
  }
  const dx = to.x - from.x
  const dy = to.y - from.y
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dy) / Math.max(1, radius * 0.35)))
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    stampBrush(mask, width, height, from.x + dx * t, from.y + dy * t, radius, value)
  }
}

export function fillHoles(mask, width, height) {
  const bg = new Uint8Array(mask.length)
  const stack = []
  const seed = (idx) => {
    if (!bg[idx] && mask[idx] <= 80) {
      bg[idx] = 1
      stack.push(idx)
    }
  }
  for (let x = 0; x < width; x++) {
    seed(x)
    seed((height - 1) * width + x)
  }
  for (let y = 0; y < height; y++) {
    seed(y * width)
    seed(y * width + width - 1)
  }
  while (stack.length) {
    const idx = stack.pop()
    if (mask[idx] > 80) continue
    const x = idx % width
    const y = (idx / width) | 0
    const nbs = [idx - 1, idx + 1, idx - width, idx + width]
    const ok = [x > 0, x + 1 < width, y > 0, y + 1 < height]
    for (let k = 0; k < 4; k++) {
      if (!ok[k]) continue
      const n = nbs[k]
      if (!bg[n] && mask[n] <= 80) {
        bg[n] = 1
        stack.push(n)
      }
    }
  }
  for (let i = 0; i < mask.length; i++) {
    if (!bg[i]) mask[i] = 255
  }
}

export function fillHolesInRegion(mask, allowed, width, height) {
  const tmp = new Uint8Array(mask)
  for (let i = 0; i < tmp.length; i++) {
    if (!allowed[i]) tmp[i] = 0
  }
  fillHoles(tmp, width, height)
  for (let i = 0; i < tmp.length; i++) {
    mask[i] = allowed[i] ? tmp[i] : 0
  }
}

export function feather(mask, width, height, radius) {
  if (radius <= 0) return
  const src = new Uint8Array(mask)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0
      let n = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          sum += src[yy * width + xx]
          n++
        }
      }
      mask[y * width + x] = sum / n
    }
  }
}

export function dilate(mask, width, height, radius = 1) {
  const src = new Uint8Array(mask)
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let max = 0
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const v = src[yy * width + xx]
          if (v > max) max = v
        }
      }
      out[y * width + x] = max
    }
  }
  return out
}

export function erode(mask, width, height, radius = 1) {
  const src = new Uint8Array(mask)
  const out = new Uint8Array(mask.length)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let min = 255
      for (let dy = -radius; dy <= radius; dy++) {
        const yy = y + dy
        if (yy < 0 || yy >= height) continue
        for (let dx = -radius; dx <= radius; dx++) {
          const xx = x + dx
          if (xx < 0 || xx >= width) continue
          const v = src[yy * width + xx]
          if (v < min) min = v
        }
      }
      out[y * width + x] = min
    }
  }
  return out
}

export function morphClose(mask, width, height, radius = 2) {
  return erode(dilate(mask, width, height, radius), width, height, radius)
}

export function morphOpen(mask, width, height, radius = 1) {
  return dilate(erode(mask, width, height, radius), width, height, radius)
}

export function scaleMask(mask, oldWidth, oldHeight, width, height) {
  const out = new Uint8Array(width * height)
  if (!oldWidth || !oldHeight) return out
  for (let y = 0; y < height; y++) {
    const sy = Math.min(oldHeight - 1, Math.floor((y * oldHeight) / height))
    for (let x = 0; x < width; x++) {
      const sx = Math.min(oldWidth - 1, Math.floor((x * oldWidth) / width))
      out[y * width + x] = mask[sy * oldWidth + sx]
    }
  }
  return out
}

export function maskToOverlay(mask, width, height) {
  const out = new ImageData(width, height)
  for (let i = 0; i < mask.length; i++) {
    const alpha = mask[i]
    if (alpha < 8) continue
    const p = i * 4
    out.data[p] = 14
    out.data[p + 1] = 165
    out.data[p + 2] = 233
    out.data[p + 3] = Math.round(alpha * 0.5)
  }
  return out
}

export function pointerToCanvasPoint(event, canvas, width, height) {
  const rect = canvas.getBoundingClientRect()
  const x = ((event.clientX - rect.left) / rect.width) * width
  const y = ((event.clientY - rect.top) / rect.height) * height
  return {
    x: Math.min(width, Math.max(0, x)),
    y: Math.min(height, Math.max(0, y)),
  }
}

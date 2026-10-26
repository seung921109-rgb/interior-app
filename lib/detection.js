export function maskOffset(x, y, width, height) {
  const px = Math.max(0, Math.min(width - 1, Math.round(x)))
  const py = Math.max(0, Math.min(height - 1, Math.round(y)))
  return py * width + px
}

export const MIN_AREA_RATIO = 0.05

export const CATEGORY_RANK = {
  cabinet: 0,
  door: 1,
  window: 2,
  counter: 3,
  sink: 4,
  chair: 4,
  couch: 4,
  bed: 4,
  toilet: 4,
  tv: 4,
  object: 5,
  wall: 8,
  floor: 9,
  tile: 10,
}

export function countMaskPixels(mask) {
  let count = 0
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 24) count++
  }
  return count
}

export function isThinStrip(mask, width, height) {
  const box = boxFromMask(mask, width, height)
  if (!box) return true
  const [ymin, xmin, ymax, xmax] = box
  const bh = (ymax - ymin) / 1000
  const bw = (xmax - xmin) / 1000
  if (bh < 0.045 || bw < 0.045) return true
  const aspect = bh / Math.max(bw, 0.001)
  if (aspect < 0.14 || aspect > 7) return true
  const boxPixels = Math.max(1, bh * height * bw * width)
  const fill = countMaskPixels(mask) / boxPixels
  return fill < 0.28 && (aspect < 0.28 || aspect > 3.6)
}

export function readDetectionPayload(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.objects)) return payload.objects
  if (Array.isArray(payload?.detections)) return payload.detections
  return []
}

export function maskFromDetection(item, width, height) {
  const raw = item?.mask
  if (!raw || raw.length !== width * height) return null
  return raw instanceof Uint8Array ? raw : Uint8Array.from(raw, (value) => (value > 24 ? 255 : 0))
}

export function prepareDetections(items, width, height) {
  const minPixels = Math.round(width * height * MIN_AREA_RATIO)
  const kept = []
  for (const item of items) {
    if (!item?.mask || item.mask.length !== width * height) continue
    const area = countMaskPixels(item.mask)
    if (area < minPixels) continue
    if (isThinStrip(item.mask, width, height)) continue
    kept.push({ ...item, area })
  }
  kept.sort((a, b) => {
    const rankA = CATEGORY_RANK[a.category] ?? 6
    const rankB = CATEGORY_RANK[b.category] ?? 6
    if (rankA !== rankB) return rankA - rankB
    return b.area - a.area
  })
  let slot = 1
  return kept.slice(0, 6).map((item, index) => {
    const rank = CATEGORY_RANK[item.category] ?? 6
    const furniture = rank <= 4 && slot <= 3
    const nextSlot = furniture ? slot : null
    if (furniture) slot += 1
    const detail = item.detail || item.label
    return {
      id: furniture ? `object-${nextSlot}` : String(item.id || `surface-${index + 1}`),
      mask: item.mask,
      label: furniture ? `사물 영역 ${nextSlot}` : String(item.label || "면"),
      area: item.area,
      detail,
      category: item.category || "object",
      slot: nextSlot,
      box: item.box || null,
      polygon: item.polygon || [],
      confidence: Number(item.confidence) || 0,
      text: item.text || "",
      index,
    }
  })
}

export function clamp1000(value) {
  return Math.max(0, Math.min(1000, Math.round(value)))
}

export function normalizeBox(box) {
  if (!Array.isArray(box) || box.length < 4) return null
  const nums = box.slice(0, 4).map(Number)
  if (nums.some((value) => !Number.isFinite(value))) return null
  const max = Math.max(...nums.map((value) => Math.abs(value)))
  const scale = max <= 1.5 ? 1000 : 1
  const [ymin, xmin, ymax, xmax] = nums.map((value) => clamp1000(value * scale))
  if (ymax <= ymin || xmax <= xmin) return null
  return [ymin, xmin, ymax, xmax]
}

export function normalizePolygon(polygon) {
  if (!Array.isArray(polygon)) return []
  const points = []
  let max = 0
  for (const point of polygon) {
    if (!Array.isArray(point) || point.length < 2) continue
    const x = Number(point[0])
    const y = Number(point[1])
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    max = Math.max(max, Math.abs(x), Math.abs(y))
    points.push([x, y])
  }
  if (points.length < 3) return []
  const scale = max <= 1.5 ? 1000 : 1
  return points.map(([x, y]) => [clamp1000(x * scale), clamp1000(y * scale)])
}

export function boxFromMask(mask, width, height) {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] < 24) continue
    const x = i % width
    const y = (i / width) | 0
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (maxX < 0) return null
  const sx = Math.max(1, width - 1)
  const sy = Math.max(1, height - 1)
  return [
    clamp1000((minY / sy) * 1000),
    clamp1000((minX / sx) * 1000),
    clamp1000((maxY / sy) * 1000),
    clamp1000((maxX / sx) * 1000),
  ]
}

const NEIGHBORS = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
  [1, -1],
]

export function contourOfMask(mask, width, height, maxPoints = 28) {
  let start = -1
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] > 24) {
      start = i
      break
    }
  }
  if (start < 0) return []
  const sx = start % width
  const sy = (start / width) | 0
  const points = []
  let x = sx
  let y = sy
  let dir = 0
  const limit = Math.min(mask.length, width * height)
  for (let step = 0; step < limit; step++) {
    points.push([x, y])
    let found = false
    for (let turn = 0; turn < 8; turn++) {
      const nextDir = (dir + 6 + turn) % 8
      const nx = x + NEIGHBORS[nextDir][0]
      const ny = y + NEIGHBORS[nextDir][1]
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
      if (mask[ny * width + nx] < 24) continue
      x = nx
      y = ny
      dir = nextDir
      found = true
      break
    }
    if (!found) break
    if (x === sx && y === sy && points.length > 8) break
  }
  if (points.length <= maxPoints) return points
  const corners = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const previous = points[i - 1]
    const current = points[i]
    const next = points[i + 1]
    const turnX = current[0] - previous[0] !== next[0] - current[0]
    const turnY = current[1] - previous[1] !== next[1] - current[1]
    if (turnX || turnY) corners.push(current)
  }
  corners.push(points[points.length - 1])
  if (corners.length <= maxPoints) return corners
  const stride = Math.ceil(corners.length / maxPoints)
  const slim = []
  for (let i = 0; i < corners.length; i += stride) slim.push(corners[i])
  return slim
}

export function geometryFromMask(mask, width, height) {
  const box = boxFromMask(mask, width, height)
  const contour = contourOfMask(mask, width, height)
  const sx = Math.max(1, width - 1)
  const sy = Math.max(1, height - 1)
  const polygon = contour.map(([x, y]) => [
    clamp1000((x / sx) * 1000),
    clamp1000((y / sy) * 1000),
  ])
  return { box, polygon }
}

export function polygonToMask(points, width, height) {
  const mask = new Uint8Array(width * height)
  if (!points || points.length < 3) return mask
  let minY = height
  let maxY = 0
  for (const point of points) {
    minY = Math.min(minY, point[1])
    maxY = Math.max(maxY, point[1])
  }
  minY = Math.max(0, Math.floor(minY))
  maxY = Math.min(height - 1, Math.ceil(maxY))
  for (let y = minY; y <= maxY; y++) {
    const hits = []
    for (let i = 0; i < points.length; i++) {
      const [x1, y1] = points[i]
      const [x2, y2] = points[(i + 1) % points.length]
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1 || 1)
        hits.push(x1 + t * (x2 - x1))
      }
    }
    hits.sort((a, b) => a - b)
    for (let k = 0; k + 1 < hits.length; k += 2) {
      const left = Math.max(0, Math.ceil(hits[k]))
      const right = Math.min(width - 1, Math.floor(hits[k + 1]))
      for (let x = left; x <= right; x++) mask[y * width + x] = 255
    }
  }
  return mask
}

export function boxToMask(box, width, height) {
  const mask = new Uint8Array(width * height)
  if (!box) return mask
  const [ymin, xmin, ymax, xmax] = box
  const x0 = Math.max(0, Math.floor((xmin / 1000) * width))
  const y0 = Math.max(0, Math.floor((ymin / 1000) * height))
  const x1 = Math.min(width - 1, Math.ceil((xmax / 1000) * width) - 1)
  const y1 = Math.min(height - 1, Math.ceil((ymax / 1000) * height) - 1)
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) mask[y * width + x] = 255
  }
  return mask
}

export function polygonToPixels(polygon, width, height) {
  return polygon.map(([x, y]) => [(x / 1000) * (width - 1), (y / 1000) * (height - 1)])
}

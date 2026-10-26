export const REGION_IDS = ["region1", "region2", "region3"]

export const REGION_TINTS = [
  [48, 168, 255],
  [255, 168, 48],
  [72, 196, 128],
]

export function regionLabel(index) {
  return `영역 ${index + 1}`
}

export function regionIdFrom(value) {
  if (value === 1 || value === 2 || value === 3) return `region${value}`
  if (value === "1" || value === "2" || value === "3") return `region${value}`
  return value
}

export function regionNumber(id) {
  const match = /^region([123])$/.exec(String(id || ""))
  return match ? Number(match[1]) : 1
}

export function createRegionBuffers(length) {
  const n = Math.max(1, length)
  return REGION_IDS.map((id, index) => ({
    id,
    label: regionLabel(index),
    index,
    mask: new Uint8Array(n),
    paint: new Uint8Array(n),
    prompts: [],
    maskHistory: [],
  }))
}

export function createRegionMetas() {
  return REGION_IDS.map((id, index) => ({
    id,
    label: regionLabel(index),
    index,
    hasMask: false,
    color: null,
    texture: null,
    appliedColor: null,
    appliedTexture: null,
  }))
}

export function regionsToOverlay(regions, width, height, activeId) {
  const out = new ImageData(width, height)
  const list = REGION_IDS.map((id) => regions?.[id]).filter((item) => item?.mask)
  const ordered = [
    ...list.filter((item) => item.id !== activeId),
    ...list.filter((item) => item.id === activeId),
  ]
  for (const region of ordered) {
    const mask = region.mask
    const tint = REGION_TINTS[region.index] || REGION_TINTS[0]
    const active = region.id === activeId
    const n = Math.min(mask.length, width * height)
    for (let i = 0; i < n; i++) {
      if (mask[i] < 8) continue
      const x = i % width
      const y = (i / width) | 0
      const edge =
        (x > 0 && mask[i - 1] < 8) ||
        (x + 1 < width && mask[i + 1] < 8) ||
        (y > 0 && mask[i - width] < 8) ||
        (y + 1 < height && mask[i + width] < 8)
      const p = i * 4
      out.data[p] = tint[0]
      out.data[p + 1] = tint[1]
      out.data[p + 2] = tint[2]
      out.data[p + 3] = edge ? 235 : active ? 155 : 105
    }
  }
  return out
}

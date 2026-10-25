export const MAX_SUBJECTS = 2
export const MIN_SUBJECTS = 1

export function normalizeSubjects(input) {
  const source = Array.isArray(input)
    ? input
    : input == null || input === ""
      ? []
      : [input]
  const seen = new Set()
  const next = []
  for (const item of source) {
    const label = String(item ?? "")
      .replace(/\s+/g, " ")
      .trim()
    if (!label || seen.has(label)) continue
    seen.add(label)
    next.push(label)
    if (next.length >= MAX_SUBJECTS) break
  }
  return Object.freeze(next)
}

export function canCommitSubjects(list) {
  const size = Array.isArray(list) ? list.length : 0
  return size >= MIN_SUBJECTS && size <= MAX_SUBJECTS
}

export function objectParticle(word) {
  const text = String(word || "")
  const code = text.charCodeAt(text.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return "를"
  return (code - 0xac00) % 28 === 0 ? "를" : "을"
}

export function andParticle(word) {
  const text = String(word || "")
  const code = text.charCodeAt(text.length - 1)
  if (code < 0xac00 || code > 0xd7a3) return "와"
  return (code - 0xac00) % 28 === 0 ? "와" : "과"
}

export function formatSubjectPhrase(list) {
  const items = (list || []).map((item) => String(item).trim()).filter(Boolean)
  if (!items.length) return ""
  if (items.length === 1) return `${items[0]}${objectParticle(items[0])}`
  return `${items[0]}${andParticle(items[0])} ${items[1]}${objectParticle(items[1])}`
}

export const SUBJECTS = [
  { id: "wall", label: "벽" },
  { id: "sink", label: "싱크대" },
  { id: "nightstand", label: "협탁" },
  { id: "wardrobe", label: "옷장" },
  { id: "tile", label: "타일" },
  { id: "chair", label: "의자" },
  { id: "bath-tile", label: "화장실 벽면/타일" },
  { id: "door", label: "문짝" },
  { id: "table", label: "테이블" },
]

const CABINET_SHAPE = {
  axis: true,
  fillSpecular: true,
  keepConcave: false,
  snapRadius: 7,
  snapBack: 3,
  openRadius: 1,
  closeRadius: 2,
  blur: 2,
  touchRadius: 28,
  inwardBias: 32,
  fingerBiasY: 12,
}

export const SHAPE_PROFILES = {
  sink: { ...CABINET_SHAPE, snapRadius: 7 },
  nightstand: { ...CABINET_SHAPE, snapRadius: 6, touchRadius: 18 },
  wardrobe: { ...CABINET_SHAPE, snapRadius: 8 },
  door: { ...CABINET_SHAPE, snapRadius: 8, touchRadius: 28, inwardBias: 36 },
  table: { ...CABINET_SHAPE, snapRadius: 7, closeRadius: 2 },
  wall: {
    axis: true,
    fillSpecular: true,
    keepConcave: false,
    snapRadius: 8,
    snapBack: 3,
    openRadius: 1,
    closeRadius: 2,
    blur: 2,
    touchRadius: 36,
    inwardBias: 18,
    fingerBiasY: 8,
  },
  tile: {
    axis: true,
    fillSpecular: true,
    keepConcave: false,
    snapRadius: 5,
    snapBack: 2,
    openRadius: 1,
    closeRadius: 2,
    blur: 2,
    touchRadius: 16,
    fingerBiasY: 8,
  },
  "bath-tile": {
    axis: true,
    fillSpecular: true,
    keepConcave: false,
    snapRadius: 5,
    snapBack: 2,
    openRadius: 1,
    closeRadius: 2,
    blur: 2,
    touchRadius: 16,
    fingerBiasY: 8,
  },
  chair: {
    axis: false,
    fillSpecular: false,
    keepConcave: true,
    snapRadius: 4,
    snapBack: 2,
    openRadius: 1,
    closeRadius: 1,
    blur: 1,
    touchRadius: 18,
    fingerBiasY: 10,
  },
}

const DEFAULT_SHAPE = {
  axis: true,
  fillSpecular: true,
  keepConcave: false,
  snapRadius: 6,
  snapBack: 3,
  openRadius: 1,
  closeRadius: 2,
  blur: 2,
  touchRadius: 20,
  fingerBiasY: 10,
}

export function shapeProfileForLabel(label) {
  const text = String(label || "").trim()
  const known = SUBJECTS.find((item) => item.label === text)
  if (known && SHAPE_PROFILES[known.id]) return SHAPE_PROFILES[known.id]
  if (/의자|체어/.test(text)) return SHAPE_PROFILES.chair
  if (text === "벽") return SHAPE_PROFILES.wall
  if (/타일|벽면/.test(text)) return SHAPE_PROFILES.tile
  if (/문짝|도어|문$/.test(text)) return SHAPE_PROFILES.door
  if (/싱크/.test(text)) return SHAPE_PROFILES.sink
  if (/테이블|식탁|책상/.test(text)) return SHAPE_PROFILES.table
  if (/옷장|장롱|캐비넷/.test(text)) return SHAPE_PROFILES.wardrobe
  if (/협탁/.test(text)) return SHAPE_PROFILES.nightstand
  return DEFAULT_SHAPE
}

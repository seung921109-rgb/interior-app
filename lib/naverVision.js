export const MIN_CONFIDENCE = 0.5
export const MIN_BOX_RATIO = 0.05

const FURNITURE = {
  sink: { label: "싱크대", category: "sink" },
  refrigerator: { label: "냉장고", category: "cabinet" },
  oven: { label: "오븐", category: "cabinet" },
  microwave: { label: "전자레인지", category: "cabinet" },
  toaster: { label: "토스터", category: "cabinet" },
  "dining table": { label: "식탁", category: "counter" },
  diningtable: { label: "식탁", category: "counter" },
  chair: { label: "의자", category: "chair" },
  couch: { label: "소파", category: "couch" },
  sofa: { label: "소파", category: "couch" },
  bed: { label: "침대", category: "bed" },
  toilet: { label: "변기", category: "toilet" },
  tv: { label: "TV", category: "tv" },
  television: { label: "TV", category: "tv" },
}

export function furnitureOf(name) {
  const key = String(name || "").trim().toLowerCase()
  return FURNITURE[key] || null
}

function asNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function boxFromDetection(box) {
  if (!Array.isArray(box) || box.length < 4) return null
  const nums = box.slice(0, 4).map(asNumber)
  if (nums.some((value) => value == null)) return null
  const max = Math.max(...nums.map((value) => Math.abs(value)))
  const scale = max <= 1.5 ? 1000 : 1
  const [ymin, xmin, ymax, xmax] = nums.map((value) => Math.max(0, Math.min(1000, Math.round(value * scale))))
  if (ymax <= ymin || xmax <= xmin) return null
  return [ymin, xmin, ymax, xmax]
}

export function boxAreaRatio(box) {
  if (!box) return 0
  return ((box[2] - box[0]) / 1000) * ((box[3] - box[1]) / 1000)
}

export function boxOverlap(a, b) {
  if (!a || !b) return 0
  const top = Math.max(a[0], b[0])
  const left = Math.max(a[1], b[1])
  const bottom = Math.min(a[2], b[2])
  const right = Math.min(a[3], b[3])
  const area = Math.max(0, bottom - top) * Math.max(0, right - left)
  const base = Math.max(1, (a[2] - a[0]) * (a[3] - a[1]))
  return area / base
}

function boxFromVertices(vertices, width, height) {
  if (!Array.isArray(vertices) || vertices.length < 2 || !width || !height) return null
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const point of vertices) {
    const x = asNumber(point?.x)
    const y = asNumber(point?.y)
    if (x == null || y == null) continue
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  if (!Number.isFinite(minX) || maxX <= minX || maxY <= minY) return null
  return boxFromDetection([
    (minY / height) * 1000,
    (minX / width) * 1000,
    (maxY / height) * 1000,
    (maxX / width) * 1000,
  ])
}

export function parseObjectDetection(payload) {
  const prediction = payload?.predictions?.[0] || payload?.prediction || null
  const names = prediction?.detection_names || payload?.detection_names || []
  const scores = prediction?.detection_scores || payload?.detection_scores || []
  const boxes = prediction?.detection_boxes || payload?.detection_boxes || []
  const objects = []
  const count = Math.min(names.length, boxes.length)
  for (let index = 0; index < count; index += 1) {
    const furniture = furnitureOf(names[index])
    const confidence = asNumber(scores[index]) ?? 0
    const box = boxFromDetection(boxes[index])
    if (!furniture || confidence < MIN_CONFIDENCE || !box) continue
    if (boxAreaRatio(box) < MIN_BOX_RATIO) continue
    objects.push({
      id: `naver-${objects.length + 1}`,
      label: furniture.label,
      category: furniture.category,
      confidence,
      text: "",
      box,
      area: boxAreaRatio(box),
    })
  }
  return objects
}

export function parseOcr(payload, width, height) {
  const fields = payload?.images?.[0]?.fields || payload?.fields || []
  const texts = []
  for (const field of fields) {
    const text = String(field?.inferText || field?.text || "").trim()
    const confidence = asNumber(field?.inferConfidence ?? field?.confidence) ?? 0
    const box = boxFromVertices(field?.boundingPoly?.vertices, width, height)
    if (!text || confidence < MIN_CONFIDENCE || !box) continue
    texts.push({
      id: `text-${texts.length + 1}`,
      text: text.slice(0, 40),
      confidence,
      box,
    })
  }
  return texts
}

export function attachOcrText(objects, texts) {
  return objects.map((object) => {
    let best = null
    let score = 0.15
    for (const text of texts) {
      const overlap = boxOverlap(text.box, object.box)
      if (overlap > score) {
        score = overlap
        best = text
      }
    }
    return best ? { ...object, text: best.text } : object
  })
}

export function standardizeNaverVision({ detection, ocr, width, height }) {
  const texts = parseOcr(ocr, width, height)
  const objects = attachOcrText(parseObjectDetection(detection), texts)
  return { objects, texts }
}

import { countMaskOn, intersectMasks, strictRegionFromPoint } from "@/lib/maskConstraint"
import {
  geometryFromMask,
  maskFromDetection,
  normalizeBox,
  normalizePolygon,
  polygonToMask,
  polygonToPixels,
  prepareDetections,
  readDetectionPayload,
  boxToMask,
} from "@/lib/detection"

function normalizeCategory(category, label) {
  const text = `${category || ""} ${label || ""}`
  if (/상부|하부|수납|cabinet|wardrobe/i.test(text)) return "cabinet"
  if (/창문|window/i.test(text)) return "window"
  if (/상판|counter/i.test(text)) return "counter"
  if (/싱크|sink/i.test(text)) return "sink"
  if (/냉장고|오븐|전자레인지|토스터|refrigerator|oven|microwave/i.test(text)) return "cabinet"
  if (/식탁|dining/i.test(text)) return "counter"
  if (/의자|chair/i.test(text)) return "chair"
  if (/소파|couch|sofa/i.test(text)) return "couch"
  if (/침대|bed/i.test(text)) return "bed"
  if (/변기|toilet/i.test(text)) return "toilet"
  if (/\btv\b|텔레비전/i.test(text)) return "tv"
  if (/타일|tile/i.test(text)) return "tile"
  if (/벽|wall/i.test(text)) return "wall"
  if (/바닥|floor/i.test(text)) return "floor"
  if (/문|door/i.test(text)) return "door"
  const known = ["cabinet", "door", "window", "counter", "sink", "wall", "floor", "tile", "object"]
  return known.includes(category) ? category : "object"
}

export function materializeDetections(objects, imageData, labs) {
  const { width, height } = imageData
  const results = []
  const list = readDetectionPayload(objects)
  for (const object of list) {
    const box = normalizeBox(object?.box)
    const polygon = normalizePolygon(object?.polygon)
    let mask = maskFromDetection(object, width, height)
    if (!mask) {
      if (!box && polygon.length < 3) continue
      mask =
        polygon.length >= 3
          ? polygonToMask(polygonToPixels(polygon, width, height), width, height)
          : boxToMask(box, width, height)
    }
    const originalCount = countMaskOn(mask)
    if (labs && box && originalCount > 0) {
      const cx = ((box[1] + box[3]) / 2 / 1000) * (width - 1)
      const cy = ((box[0] + box[2]) / 2 / 1000) * (height - 1)
      const strict = strictRegionFromPoint(imageData, labs, cx, cy)
      const clipped = intersectMasks(mask, strict)
      const clippedCount = countMaskOn(clipped)
      const keepsBody = clippedCount >= originalCount * 0.55 && clippedCount >= width * height * 0.05
      if (keepsBody) mask = clipped
    }
    if (mask.length !== width * height || countMaskOn(mask) < 40) continue
    const geometry = geometryFromMask(mask, width, height)
    results.push({
      id: String(object?.id || `vision-${results.length + 1}`),
      label: String(object?.label || "사물").slice(0, 16),
      category: normalizeCategory(object?.category, object?.label),
      box: box || geometry.box,
      polygon: geometry.polygon.length >= 3 ? geometry.polygon : polygon,
      confidence: Number(object?.confidence) || 0,
      text: String(object?.text || ""),
      mask,
    })
  }
  return prepareDetections(results, width, height)
}

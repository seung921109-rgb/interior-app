import { simulationToImageData } from "@/lib/simulateRender"

export function applyFinish(source, mask, colorHex, textureId, targets) {
  if (!source) return null
  const hasJobs = Array.isArray(targets) && targets.length > 0
  if (!hasJobs && !colorHex && !textureId) {
    const out = new ImageData(source.width, source.height)
    out.data.set(source.data)
    return out
  }
  return simulationToImageData(source, mask, colorHex, textureId, targets)
}

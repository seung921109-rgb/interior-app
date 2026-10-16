import { simulationToImageData } from "@/lib/simulateRender"

export function applyFinish(source, mask, colorHex, textureId) {
  if (!source) return null
  if (!colorHex && !textureId) {
    const out = new ImageData(source.width, source.height)
    out.data.set(source.data)
    return out
  }
  return simulationToImageData(source, mask, colorHex, textureId)
}

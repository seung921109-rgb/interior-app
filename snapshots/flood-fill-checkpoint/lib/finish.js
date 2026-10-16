import { clampByte, hexToRgb, luminance, overlayChannel } from "@/lib/color"
import { getTexture } from "@/lib/textures"

export function applyFinish(source, mask, colorHex, textureId) {
  const { width, height, data } = source
  const out = new ImageData(width, height)
  out.data.set(data)
  if (!colorHex && !textureId) return out

  const tint = colorHex ? hexToRgb(colorHex) : null
  const tex = textureId ? getTexture(textureId) : null
  const tw = tex?.width ?? 1
  const th = tex?.height ?? 1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const mi = y * width + x
      const a = mask[mi] / 255
      if (a < 0.01) continue
      const i = mi * 4
      let r = data[i]
      let g = data[i + 1]
      let b = data[i + 2]
      const lum = luminance(r, g, b) / 255

      if (tex) {
        const ti = ((y % th) * tw + (x % tw)) * 4
        r = overlayChannel(r, tex.data[ti])
        g = overlayChannel(g, tex.data[ti + 1])
        b = overlayChannel(b, tex.data[ti + 2])
      }

      if (tint) {
        const shade = 0.35 + lum * 1.15
        r = tint.r * shade
        g = tint.g * shade
        b = tint.b * shade
        if (tex) {
          const ti = ((y % th) * tw + (x % tw)) * 4
          const grain =
            (tex.data[ti] + tex.data[ti + 1] + tex.data[ti + 2]) / (3 * 255)
          r *= 0.55 + grain * 0.7
          g *= 0.55 + grain * 0.7
          b *= 0.55 + grain * 0.7
        }
      }

      out.data[i] = clampByte(r * a + data[i] * (1 - a))
      out.data[i + 1] = clampByte(g * a + data[i + 1] * (1 - a))
      out.data[i + 2] = clampByte(b * a + data[i + 2] * (1 - a))
    }
  }
  return out
}

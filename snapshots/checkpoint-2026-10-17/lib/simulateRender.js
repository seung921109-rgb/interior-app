import { getTexture } from "@/lib/textures"
import { maskHasSelection } from "@/lib/mask"

function ctx2d(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true })
}

function parseHex(hex) {
  if (!hex || hex[0] !== "#" || (hex.length !== 7 && hex.length !== 4)) {
    return null
  }
  let n = hex.slice(1)
  if (n.length === 3) {
    n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2]
  }
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)]
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

function overlayChannel(base, blend) {
  return base < 128
    ? (2 * base * blend) / 255
    : 255 - (2 * (255 - base) * (255 - blend)) / 255
}

function boxBlur(src, w, h, radius, tmp, dst) {
  const span = radius * 2 + 1
  for (let y = 0; y < h; y++) {
    const row = y * w
    let sum = 0
    for (let k = -radius; k <= radius; k++) {
      const x = k < 0 ? 0 : k >= w ? w - 1 : k
      sum += src[row + x]
    }
    for (let x = 0; x < w; x++) {
      tmp[row + x] = sum / span
      const drop = x - radius
      const add = x + radius + 1
      sum -= src[row + (drop < 0 ? 0 : drop)]
      sum += src[row + (add >= w ? w - 1 : add)]
    }
  }
  for (let x = 0; x < w; x++) {
    let sum = 0
    for (let k = -radius; k <= radius; k++) {
      const y = k < 0 ? 0 : k >= h ? h - 1 : k
      sum += tmp[y * w + x]
    }
    for (let y = 0; y < h; y++) {
      dst[y * w + x] = sum / span
      const drop = y - radius
      const add = y + radius + 1
      sum -= tmp[(drop < 0 ? 0 : drop) * w + x]
      sum += tmp[(add >= h ? h - 1 : add) * w + x]
    }
  }
}

function lumaOf(r, g, b) {
  return r * 0.2126 + g * 0.7152 + b * 0.0722
}

function analyzePhoto(layers, imageData, width, height, photoId) {
  const key = `${width}x${height}:${photoId}:${imageData.data.length}`
  if (layers.photoKey === key && layers.lum) return
  const n = width * height
  const src = imageData.data
  const lum = layers.lum?.length === n ? layers.lum : new Float32Array(n)
  const blurY = layers.blurY?.length === n ? layers.blurY : new Float32Array(n)
  const gx = layers.gx?.length === n ? layers.gx : new Float32Array(n)
  const gy = layers.gy?.length === n ? layers.gy : new Float32Array(n)

  for (let i = 0, p = 0; i < n; i++, p += 4) {
    lum[i] = lumaOf(src[p], src[p + 1], src[p + 2])
  }
  boxBlur(
    lum,
    width,
    height,
    4,
    layers.scratch1 || (layers.scratch1 = new Float32Array(n)),
    blurY,
  )

  for (let y = 0; y < height; y++) {
    const ym = y === 0 ? 0 : y - 1
    const yp = y === height - 1 ? height - 1 : y + 1
    for (let x = 0; x < width; x++) {
      const xm = x === 0 ? 0 : x - 1
      const xp = x === width - 1 ? width - 1 : x + 1
      const i = y * width + x
      gx[i] =
        -blurY[ym * width + xm] -
        2 * blurY[y * width + xm] -
        blurY[yp * width + xm] +
        blurY[ym * width + xp] +
        2 * blurY[y * width + xp] +
        blurY[yp * width + xp]
      gy[i] =
        -blurY[ym * width + xm] -
        2 * blurY[ym * width + x] -
        blurY[ym * width + xp] +
        blurY[yp * width + xm] +
        2 * blurY[yp * width + x] +
        blurY[yp * width + xp]
    }
  }

  layers.lum = lum
  layers.blurY = blurY
  layers.gx = gx
  layers.gy = gy
  layers.photoKey = key
  layers.meanKey = ""
}

function maskMeanLuma(lum, mask, n) {
  let sum = 0
  let wsum = 0
  for (let i = 0; i < n; i++) {
    const w = mask[i]
    if (w < 8) continue
    const a = w / 255
    sum += lum[i] * a
    wsum += a
  }
  return wsum > 4 ? sum / wsum : 128
}

function sampleTexture(tex, u, v) {
  const tw = tex.width
  const th = tex.height
  const data = tex.data
  let x = u % tw
  let y = v % th
  if (x < 0) x += tw
  if (y < 0) y += th
  const x0 = x | 0
  const y0 = y | 0
  const x1 = x0 + 1 < tw ? x0 + 1 : 0
  const y1 = y0 + 1 < th ? y0 + 1 : 0
  const fx = x - x0
  const fy = y - y0
  const i00 = (y0 * tw + x0) * 4
  const i10 = (y0 * tw + x1) * 4
  const i01 = (y1 * tw + x0) * 4
  const i11 = (y1 * tw + x1) * 4
  const w00 = (1 - fx) * (1 - fy)
  const w10 = fx * (1 - fy)
  const w01 = (1 - fx) * fy
  const w11 = fx * fy
  return [
    data[i00] * w00 + data[i10] * w10 + data[i01] * w01 + data[i11] * w11,
    data[i00 + 1] * w00 + data[i10 + 1] * w10 + data[i01 + 1] * w01 + data[i11 + 1] * w11,
    data[i00 + 2] * w00 + data[i10 + 2] * w10 + data[i01 + 2] * w01 + data[i11 + 2] * w11,
  ]
}

const texMeanCache = new Map()

function textureMeanLuma(tex, id) {
  let mean = texMeanCache.get(id)
  if (mean) return mean
  const { data } = tex
  let sum = 0
  const count = tex.width * tex.height
  for (let i = 0; i < data.length; i += 4) {
    sum += lumaOf(data[i], data[i + 1], data[i + 2])
  }
  mean = Math.max(48, sum / count)
  texMeanCache.set(id, mean)
  return mean
}

function textureScale(id, minSide) {
  if (id === "marble" || id === "travertine") return minSide / 4.2
  if (id === "herringbone") return minSide / 5.6
  if (id === "concrete") return minSide / 5
  if (id === "fabric") return 34
  return minSide / 6.6
}

function wrapAlbedo(tex, id, x, y, width, height, gx, gy, lum, blurY) {
  const tile = textureScale(id, Math.min(width, height))
  const nx = gx / 720
  const ny = gy / 720
  const bump = (lum - blurY) / 28
  const wrap = 58 + Math.abs(bump) * 22
  const u = (x + nx * wrap + bump * nx * 40) * (tex.width / tile)
  const v = (y + ny * wrap + bump * ny * 40) * (tex.height / tile)
  const sample = sampleTexture(tex, u, v)
  const nrm = 132 / textureMeanLuma(tex, id)
  return [sample[0] * nrm, sample[1] * nrm, sample[2] * nrm]
}

function lightingGain(Y, blurY, meanY) {
  const form = blurY / Math.max(18, meanY)
  const groove = 1 + (Y - blurY) / 52
  const relative = 1 + (Y / Math.max(18, meanY) - 1) * 1.38
  const gain = form * 0.42 + groove * relative * 0.58
  return clamp(gain, 0.16, 2.15)
}

function lightAlbedo(ar, ag, ab, Y, blurY, meanY) {
  const gain = lightingGain(Y, blurY, meanY)
  const mr = ar * gain
  const mg = ag * gain
  const mb = ab * gain
  const lightMap = clamp(127.5 * gain, 12, 250)
  const or_ = overlayChannel(ar, lightMap)
  const og = overlayChannel(ag, lightMap)
  const ob = overlayChannel(ab, lightMap)
  let r = mr * 0.78 + or_ * 0.22
  let g = mg * 0.78 + og * 0.22
  let b = mb * 0.78 + ob * 0.22
  const hi = clamp((Y - meanY * 1.12) / 70, 0, 1)
  const spec = hi * hi * 0.22
  r += (255 - r) * spec
  g += (255 - g) * spec
  b += (255 - b) * spec
  return [r, g, b]
}

function blendMaskedFinish(layers, imageData, mask, colorHex, textureId, width, height, version) {
  const n = width * height
  const src = imageData.data
  const out = layers.outData
  const data = out.data
  data.set(src)

  const meanKey = `${layers.photoKey}:${version}:${mask.length}`
  let meanY = layers.meanY
  if (layers.meanKey !== meanKey) {
    meanY = maskMeanLuma(layers.lum, mask, n)
    layers.meanY = meanY
    layers.meanKey = meanKey
  }

  const paint = parseHex(colorHex)
  const tex = textureId ? getTexture(textureId) : null
  const grainAmt = tex ? 0.28 : 0.72
  const { lum, blurY, gx, gy } = layers

  for (let i = 0; i < n; i++) {
    const m = mask[i]
    if (m < 6) continue
    const a = m / 255
    const p = i * 4
    let ar
    let ag
    let ab
    if (tex) {
      const x = i % width
      const y = (i / width) | 0
      const sample = wrapAlbedo(
        tex,
        textureId,
        x,
        y,
        width,
        height,
        gx[i],
        gy[i],
        lum[i],
        blurY[i],
      )
      ar = sample[0]
      ag = sample[1]
      ab = sample[2]
      if (paint) {
        ar = ar * 0.62 + overlayChannel(sample[0], paint[0]) * 0.38
        ag = ag * 0.62 + overlayChannel(sample[1], paint[1]) * 0.38
        ab = ab * 0.62 + overlayChannel(sample[2], paint[2]) * 0.38
      }
    } else if (paint) {
      ar = paint[0]
      ag = paint[1]
      ab = paint[2]
    } else {
      continue
    }

    const lit = lightAlbedo(ar, ag, ab, lum[i], blurY[i], meanY)
    const grain = (lum[i] - blurY[i]) * grainAmt
    const br = clampByte(lit[0] + grain)
    const bg = clampByte(lit[1] + grain)
    const bb = clampByte(lit[2] + grain)
    data[p] = src[p] + (br - src[p]) * a
    data[p + 1] = src[p + 1] + (bg - src[p + 1]) * a
    data[p + 2] = src[p + 2] + (bb - src[p + 2]) * a
  }
}

export function createSimulationLayers() {
  return {
    photo: document.createElement("canvas"),
    mix: document.createElement("canvas"),
    photoKey: "",
    meanKey: "",
    meanY: 128,
    lum: null,
    blurY: null,
    gx: null,
    gy: null,
    scratch1: null,
    outData: null,
  }
}

export function renderSimulation(
  ctx,
  layers,
  {
    imageData,
    mask,
    color,
    texture,
    width,
    height,
    version,
    photoId,
    drawWidth,
    drawHeight,
  },
) {
  const dw = drawWidth || width
  const dh = drawHeight || height
  analyzePhoto(layers, imageData, width, height, photoId || "")

  if (!layers.outData || layers.outData.width !== width || layers.outData.height !== height) {
    layers.outData = new ImageData(width, height)
  }

  const hasFinish = Boolean(color || texture)
  if (!hasFinish || !mask || !maskHasSelection(mask)) {
    if (dw === width && dh === height) {
      ctx.putImageData(imageData, 0, 0)
      return
    }
    const photo = layers.photo
    if (photo.width !== width) photo.width = width
    if (photo.height !== height) photo.height = height
    ctx2d(photo).putImageData(imageData, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(photo, 0, 0, dw, dh)
    return
  }

  blendMaskedFinish(layers, imageData, mask, color, texture, width, height, version)
  if (dw === width && dh === height) {
    ctx.putImageData(layers.outData, 0, 0)
    return
  }
  const mix = layers.mix
  if (mix.width !== width) mix.width = width
  if (mix.height !== height) mix.height = height
  ctx2d(mix).putImageData(layers.outData, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(mix, 0, 0, dw, dh)
}

export function simulationToImageData(imageData, mask, color, texture) {
  const { width, height } = imageData
  const layers = createSimulationLayers()
  const out = document.createElement("canvas")
  out.width = width
  out.height = height
  const ctx = ctx2d(out)
  renderSimulation(ctx, layers, {
    imageData,
    mask,
    color,
    texture,
    width,
    height,
    version: 1,
  })
  return ctx.getImageData(0, 0, width, height)
}

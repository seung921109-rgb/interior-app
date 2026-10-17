import { getTexture, isTiledFinish } from "@/lib/textures"
import { maskHasSelection } from "@/lib/mask"

function ctx2d(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true })
}

function ensureSize(canvas, width, height) {
  if (canvas.width !== width) canvas.width = width
  if (canvas.height !== height) canvas.height = height
  return ctx2d(canvas)
}

function parseHex(hex) {
  if (!hex || hex[0] !== "#" || (hex.length !== 7 && hex.length !== 4)) {
    return null
  }
  let n = hex.slice(1)
  if (n.length === 3) {
    n = n[0] + n[0] + n[1] + n[1] + n[2] + n[2]
  }
  return `#${n}`
}

function textureScale(id, minSide) {
  if (id === "marble" || id === "travertine") return minSide / 4.4
  if (id === "herringbone") return minSide / 5.6
  if (id === "concrete") return minSide / 5
  if (id === "fabric") return 36
  return minSide / 6.4
}

function tileCellSize(id, width, height) {
  return Math.max(36, textureScale(id, Math.min(width, height)))
}

function writeMaskCanvas(canvas, mask, width, height) {
  const ctx = ensureSize(canvas, width, height)
  const image = ctx.createImageData(width, height)
  const data = image.data
  const n = width * height
  for (let i = 0; i < n; i++) {
    const p = i * 4
    const a = mask[i]
    data[p] = 255
    data[p + 1] = 255
    data[p + 2] = 255
    data[p + 3] = a
  }
  ctx.putImageData(image, 0, 0)
}

function buildLumaCanvases(layers, imageData, width, height, photoId) {
  const key = `${width}x${height}:${photoId}:${imageData.data.length}`
  if (layers.lumaKey === key) return

  const photo = layers.photo
  const luma = layers.luma
  const lumaLift = layers.lumaLift
  const pctx = ensureSize(photo, width, height)
  pctx.putImageData(imageData, 0, 0)

  const lctx = ensureSize(luma, width, height)
  lctx.clearRect(0, 0, width, height)
  lctx.globalCompositeOperation = "source-over"
  lctx.drawImage(photo, 0, 0)
  lctx.globalCompositeOperation = "saturation"
  lctx.fillStyle = "#808080"
  lctx.fillRect(0, 0, width, height)
  lctx.globalCompositeOperation = "source-over"

  const lift = ensureSize(lumaLift, width, height)
  lift.clearRect(0, 0, width, height)
  lift.globalCompositeOperation = "source-over"
  lift.drawImage(luma, 0, 0)
  lift.globalCompositeOperation = "screen"
  lift.fillStyle = "rgba(255,255,255,0.18)"
  lift.fillRect(0, 0, width, height)
  lift.globalCompositeOperation = "source-over"

  layers.lumaKey = key
}

function fillAlbedo(ctx, layers, colorHex, textureId, width, height) {
  ctx.save()
  ctx.globalCompositeOperation = "source-over"
  ctx.clearRect(0, 0, width, height)

  const paint = parseHex(colorHex)
  const tex = textureId ? getTexture(textureId) : null

  if (tex) {
    const stamp = layers.texStamp
    const sctx = ensureSize(stamp, tex.width, tex.height)
    if (layers.texStampId !== textureId) {
      sctx.putImageData(tex, 0, 0)
      layers.texStampId = textureId
    }
    const pattern = ctx.createPattern(stamp, "repeat")
    const cell = textureScale(textureId, Math.min(width, height))
    const scale = cell / tex.width
    ctx.save()
    ctx.scale(scale, scale)
    ctx.fillStyle = pattern
    ctx.fillRect(0, 0, width / scale, height / scale)
    ctx.restore()

    if (paint) {
      ctx.globalCompositeOperation = "multiply"
      ctx.fillStyle = paint
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = "soft-light"
      ctx.globalAlpha = 0.55
      ctx.fillStyle = paint
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
    }
  } else if (paint) {
    ctx.fillStyle = paint
    ctx.fillRect(0, 0, width, height)
  }

  ctx.restore()
}

function soakLighting(ctx, layers, width, height) {
  ctx.save()
  ctx.globalCompositeOperation = "multiply"
  ctx.drawImage(layers.lumaLift, 0, 0, width, height)

  ctx.globalCompositeOperation = "overlay"
  ctx.globalAlpha = 0.62
  ctx.drawImage(layers.luma, 0, 0, width, height)

  ctx.globalCompositeOperation = "soft-light"
  ctx.globalAlpha = 0.48
  ctx.drawImage(layers.luma, 0, 0, width, height)
  ctx.restore()
}

function drawTileRelief(ctx, width, height, cell) {
  const grout = Math.max(1.35, Math.min(3.2, cell * 0.042))
  ctx.save()

  ctx.globalCompositeOperation = "multiply"
  ctx.strokeStyle = "rgba(58,52,46,0.38)"
  ctx.lineWidth = grout
  ctx.beginPath()
  for (let x = 0; x <= width + 0.5; x += cell) {
    ctx.moveTo(x + 0.5, 0)
    ctx.lineTo(x + 0.5, height)
  }
  for (let y = 0; y <= height + 0.5; y += cell) {
    ctx.moveTo(0, y + 0.5)
    ctx.lineTo(width, y + 0.5)
  }
  ctx.stroke()

  ctx.globalCompositeOperation = "multiply"
  ctx.strokeStyle = "rgba(36,30,26,0.32)"
  ctx.lineWidth = 1.35
  ctx.beginPath()
  for (let x = cell; x < width; x += cell) {
    ctx.moveTo(x - grout * 0.55, 0)
    ctx.lineTo(x - grout * 0.55, height)
  }
  for (let y = cell; y < height; y += cell) {
    ctx.moveTo(0, y - grout * 0.55)
    ctx.lineTo(width, y - grout * 0.55)
  }
  ctx.stroke()

  ctx.globalCompositeOperation = "overlay"
  ctx.strokeStyle = "rgba(255,248,238,0.42)"
  ctx.lineWidth = 1.15
  ctx.beginPath()
  for (let x = 0; x < width; x += cell) {
    ctx.moveTo(x + grout * 0.9, 0)
    ctx.lineTo(x + grout * 0.9, height)
  }
  for (let y = 0; y < height; y += cell) {
    ctx.moveTo(0, y + grout * 0.9)
    ctx.lineTo(width, y + grout * 0.9)
  }
  ctx.stroke()

  ctx.globalCompositeOperation = "soft-light"
  ctx.strokeStyle = "rgba(255,255,255,0.55)"
  ctx.lineWidth = 0.9
  ctx.beginPath()
  for (let x = 0; x < width; x += cell) {
    ctx.moveTo(x + grout * 1.35, 0)
    ctx.lineTo(x + grout * 1.35, height)
  }
  for (let y = 0; y < height; y += cell) {
    ctx.moveTo(0, y + grout * 1.35)
    ctx.lineTo(width, y + grout * 1.35)
  }
  ctx.stroke()

  ctx.restore()
}

function compositeFinish(layers, imageData, mask, color, texture, width, height, version, photoId) {
  buildLumaCanvases(layers, imageData, width, height, photoId || "")

  const maskKey = `${layers.lumaKey}:${version}:${mask.length}`
  if (layers.maskKey !== maskKey) {
    writeMaskCanvas(layers.mask, mask, width, height)
    layers.maskKey = maskKey
  }

  const photo = layers.photo
  const pctx = ensureSize(photo, width, height)
  pctx.globalCompositeOperation = "source-over"
  pctx.putImageData(imageData, 0, 0)

  const finish = layers.finish
  const fctx = ensureSize(finish, width, height)
  fillAlbedo(fctx, layers, color, texture, width, height)
  soakLighting(fctx, layers, width, height)

  if (isTiledFinish(texture)) {
    drawTileRelief(fctx, width, height, tileCellSize(texture, width, height))
  }

  fctx.globalCompositeOperation = "destination-in"
  fctx.drawImage(layers.mask, 0, 0)
  fctx.globalCompositeOperation = "source-over"

  pctx.globalCompositeOperation = "source-over"
  pctx.drawImage(finish, 0, 0)
}

export function createSimulationLayers() {
  return {
    photo: document.createElement("canvas"),
    mix: document.createElement("canvas"),
    finish: document.createElement("canvas"),
    luma: document.createElement("canvas"),
    lumaLift: document.createElement("canvas"),
    mask: document.createElement("canvas"),
    texStamp: document.createElement("canvas"),
    lumaKey: "",
    maskKey: "",
    texStampId: "",
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
  const hasFinish = Boolean(color || texture)

  if (!hasFinish || !mask || !maskHasSelection(mask)) {
    if (dw === width && dh === height) {
      ctx.putImageData(imageData, 0, 0)
      return
    }
    const photo = layers.photo
    const pctx = ensureSize(photo, width, height)
    pctx.putImageData(imageData, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(photo, 0, 0, dw, dh)
    return
  }

  compositeFinish(
    layers,
    imageData,
    mask,
    color,
    texture,
    width,
    height,
    version,
    photoId,
  )

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(layers.photo, 0, 0, dw, dh)
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

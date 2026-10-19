import { clampByte, hexToRgb, luminance } from "@/lib/color"
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
      const tintMode = lightCompositeMode(finishBrightness(paint))
      ctx.globalCompositeOperation = tintMode === "multiply" ? "multiply" : tintMode
      ctx.fillStyle = paint
      ctx.fillRect(0, 0, width, height)
      ctx.globalCompositeOperation = tintMode === "multiply" ? "soft-light" : "overlay"
      ctx.globalAlpha = tintMode === "multiply" ? 0.55 : 0.42
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

function finishBrightness(colorHex) {
  const paint = parseHex(colorHex)
  if (!paint) return 0.64
  const { r, g, b } = hexToRgb(paint)
  return luminance(r, g, b) / 255
}

function lightCompositeMode(brightness) {
  if (brightness >= 0.78) return "screen"
  if (brightness >= 0.62) return "soft-light"
  if (brightness >= 0.48) return "overlay"
  return "multiply"
}

function maskLumaStats(lumaData, mask) {
  let sum = 0
  let count = 0
  let min = 1
  let max = 0
  const n = mask.length
  for (let i = 0; i < n; i++) {
    if (mask[i] < 24) continue
    const y = lumaData[i * 4] / 255
    sum += y
    count++
    if (y < min) min = y
    if (y > max) max = y
  }
  if (!count) return { mean: 0.5, min: 0, max: 1, count: 0 }
  return { mean: sum / count, min, max, count }
}

function lightingOffsets(stats, paintBrightness) {
  const dark = stats.mean < 0.45
  const span = Math.max(0.035, stats.max - stats.min)
  const lift = Math.max(0, Math.min(1, (paintBrightness - 0.42) / 0.5))
  const contrast = dark
    ? Math.min(2.85, 0.28 / span)
    : Math.min(1.45, 0.22 / span)
  const target = dark
    ? 0.36 + 0.5 * Math.max(paintBrightness, 0.5) * (0.35 + 0.65 * lift)
    : stats.mean
  return { contrast, target, lift, dark }
}

function writeCorrectedShade(layers, mask, width, height, paintBrightness, cacheKey) {
  const key = `${layers.lumaKey}:${cacheKey}:${paintBrightness.toFixed(2)}`
  if (layers.shadeKey === key && layers.shadeOffsets) return layers.shadeOffsets
  const img = ctx2d(layers.luma).getImageData(0, 0, width, height)
  const stats = maskLumaStats(img.data, mask)
  const { contrast, target, lift, dark } = lightingOffsets(stats, paintBrightness)
  const data = img.data
  const mean = stats.mean
  for (let i = 0; i < data.length; i += 4) {
    const y = data[i] / 255
    const bent = target + (y - mean) * contrast
    const v = clampByte(Math.round(bent * 255))
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
  }
  const sctx = ensureSize(layers.shade, width, height)
  sctx.putImageData(img, 0, 0)
  layers.shadeKey = key
  layers.shadeOffsets = { contrast, target, lift, dark }
  return layers.shadeOffsets
}

function soakLighting(ctx, layers, width, height, colorHex, mask, cacheKey) {
  const brightness = finishBrightness(colorHex)
  const mode = lightCompositeMode(brightness)
  const offsets = writeCorrectedShade(
    layers,
    mask,
    width,
    height,
    brightness,
    cacheKey || "shade",
  )
  ctx.save()

  if (mode !== "multiply") {
    ctx.globalCompositeOperation = "luminosity"
    ctx.globalAlpha = 1
    ctx.drawImage(layers.shade, 0, 0, width, height)

    ctx.globalCompositeOperation = mode
    ctx.globalAlpha = mode === "screen" ? 0.28 : 0.22
    ctx.drawImage(layers.shade, 0, 0, width, height)

    ctx.globalCompositeOperation = "soft-light"
    ctx.globalAlpha = 0.42 + 0.18 * (offsets.lift || 0)
    ctx.drawImage(layers.shade, 0, 0, width, height)

    ctx.globalCompositeOperation = "overlay"
    ctx.globalAlpha = 0.2
    ctx.drawImage(layers.shade, 0, 0, width, height)
  } else {
    ctx.globalCompositeOperation = "multiply"
    ctx.drawImage(offsets.dark ? layers.shade : layers.lumaLift, 0, 0, width, height)

    ctx.globalCompositeOperation = "overlay"
    ctx.globalAlpha = 0.62
    ctx.drawImage(layers.luma, 0, 0, width, height)

    ctx.globalCompositeOperation = "soft-light"
    ctx.globalAlpha = 0.48
    ctx.drawImage(layers.luma, 0, 0, width, height)
  }

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

function listFinishJobs({ mask, color, texture, targets }) {
  if (Array.isArray(targets) && targets.length) {
    return targets.filter(
      (job) =>
        job &&
        (job.color || job.texture) &&
        job.mask &&
        maskHasSelection(job.mask),
    )
  }
  if ((color || texture) && mask && maskHasSelection(mask)) {
    return [{ id: "legacy", mask, color, texture }]
  }
  return []
}

function applyFinishJob(layers, job, width, height, version) {
  const maskKey = `${layers.lumaKey}:${job.id || "job"}:${version}:${job.mask.length}:${job.color || ""}:${job.texture || ""}`
  writeMaskCanvas(layers.mask, job.mask, width, height)
  layers.maskKey = maskKey

  const finish = layers.finish
  const fctx = ensureSize(finish, width, height)
  fillAlbedo(fctx, layers, job.color, job.texture, width, height)
  soakLighting(
    fctx,
    layers,
    width,
    height,
    job.color,
    job.mask,
    `${job.id || "job"}:${version}:${job.mask.length}`,
  )

  if (isTiledFinish(job.texture)) {
    drawTileRelief(fctx, width, height, tileCellSize(job.texture, width, height))
  }

  fctx.globalCompositeOperation = "destination-in"
  fctx.drawImage(layers.mask, 0, 0)
  fctx.globalCompositeOperation = "source-over"

  const pctx = ctx2d(layers.photo)
  pctx.globalCompositeOperation = "source-over"
  pctx.drawImage(finish, 0, 0)
}

function compositeFinishJobs(layers, imageData, jobs, width, height, version, photoId) {
  buildLumaCanvases(layers, imageData, width, height, photoId || "")
  const photo = layers.photo
  const pctx = ensureSize(photo, width, height)
  pctx.globalCompositeOperation = "source-over"
  pctx.putImageData(imageData, 0, 0)
  for (const job of jobs) {
    applyFinishJob(layers, job, width, height, version)
  }
}

export function createSimulationLayers() {
  return {
    photo: document.createElement("canvas"),
    mix: document.createElement("canvas"),
    finish: document.createElement("canvas"),
    luma: document.createElement("canvas"),
    lumaLift: document.createElement("canvas"),
    shade: document.createElement("canvas"),
    mask: document.createElement("canvas"),
    texStamp: document.createElement("canvas"),
    lumaKey: "",
    shadeKey: "",
    shadeOffsets: null,
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
    targets,
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
  const jobs = listFinishJobs({ mask, color, texture, targets })

  if (!jobs.length) {
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

  compositeFinishJobs(
    layers,
    imageData,
    jobs,
    width,
    height,
    version,
    photoId,
  )

  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(layers.photo, 0, 0, dw, dh)
}

export function simulationToImageData(imageData, mask, color, texture, targets) {
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
    targets,
    width,
    height,
    version: 1,
  })
  return ctx.getImageData(0, 0, width, height)
}

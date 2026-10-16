import { getTexture } from "@/lib/textures"
import { maskHasSelection } from "@/lib/mask"

function sizeCanvas(canvas, width, height) {
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width
    canvas.height = height
    return true
  }
  return false
}

function ctx2d(canvas) {
  return canvas.getContext("2d", { willReadFrequently: true })
}

export function createSimulationLayers() {
  return {
    photo: document.createElement("canvas"),
    lighting: document.createElement("canvas"),
    mask: document.createElement("canvas"),
    material: document.createElement("canvas"),
    mix: document.createElement("canvas"),
    tex: document.createElement("canvas"),
    photoKey: "",
    maskKey: "",
    materialKey: "",
  }
}

function paintPhoto(layers, imageData, width, height, photoId) {
  const key = `${width}x${height}:${photoId}:${imageData.data.length}`
  const resized = sizeCanvas(layers.photo, width, height)
  if (!resized && layers.photoKey === key) return
  ctx2d(layers.photo).putImageData(imageData, 0, 0)
  sizeCanvas(layers.lighting, width, height)
  const light = ctx2d(layers.lighting)
  light.clearRect(0, 0, width, height)
  light.filter = "grayscale(100%) contrast(108%) brightness(114%)"
  light.drawImage(layers.photo, 0, 0)
  light.filter = "none"
  layers.photoKey = key
  layers.maskKey = ""
}

function paintMask(layers, mask, width, height, version) {
  const key = `${width}x${height}:${version}:${mask.length}`
  const resized = sizeCanvas(layers.mask, width, height)
  if (!resized && layers.maskKey === key) return
  const ctx = ctx2d(layers.mask)
  const pixels = ctx.createImageData(width, height)
  const { data } = pixels
  const n = Math.min(mask.length, width * height)
  for (let i = 0; i < n; i++) {
    const p = i * 4
    data[p + 3] = mask[i]
  }
  ctx.putImageData(pixels, 0, 0)
  layers.maskKey = key
}

function paintMaterial(layers, colorHex, textureId, width, height) {
  const key = `${width}x${height}:${colorHex || ""}:${textureId || ""}`
  const resized = sizeCanvas(layers.material, width, height)
  if (!resized && layers.materialKey === key) return
  const ctx = ctx2d(layers.material)
  ctx.globalCompositeOperation = "source-over"
  ctx.globalAlpha = 1
  ctx.clearRect(0, 0, width, height)

  if (textureId) {
    const texture = getTexture(textureId)
    sizeCanvas(layers.tex, texture.width, texture.height)
    ctx2d(layers.tex).putImageData(texture, 0, 0)
    const pattern = ctx.createPattern(layers.tex, "repeat")
    ctx.save()
    ctx.scale(0.58, 0.58)
    ctx.fillStyle = pattern || colorHex || "#cfc8be"
    ctx.fillRect(0, 0, width / 0.58, height / 0.58)
    ctx.restore()
    if (colorHex) {
      ctx.globalCompositeOperation = "overlay"
      ctx.globalAlpha = 0.5
      ctx.fillStyle = colorHex
      ctx.fillRect(0, 0, width, height)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
    }
  } else if (colorHex) {
    ctx.fillStyle = colorHex
    ctx.fillRect(0, 0, width, height)
  }

  layers.materialKey = key
}

function blendMaskedFinish(layers, width, height) {
  sizeCanvas(layers.mix, width, height)
  const ctx = ctx2d(layers.mix)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "source-over"
  ctx.clearRect(0, 0, width, height)
  ctx.drawImage(layers.material, 0, 0)
  ctx.globalCompositeOperation = "multiply"
  ctx.drawImage(layers.lighting, 0, 0)
  ctx.globalCompositeOperation = "soft-light"
  ctx.globalAlpha = 0.26
  ctx.drawImage(layers.photo, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = "destination-in"
  ctx.drawImage(layers.mask, 0, 0)
  ctx.globalCompositeOperation = "source-over"
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
  paintPhoto(layers, imageData, width, height, photoId || "")
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(layers.photo, 0, 0, dw, dh)

  const hasFinish = Boolean(color || texture)
  if (!hasFinish || !mask || !maskHasSelection(mask)) return

  paintMask(layers, mask, width, height, version)
  paintMaterial(layers, color, texture, width, height)
  blendMaskedFinish(layers, width, height)
  ctx.drawImage(layers.mix, 0, 0, dw, dh)
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

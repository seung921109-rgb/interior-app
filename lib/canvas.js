export function backingSize(cssWidth, cssHeight, dpr = 1) {
  const ratio = Math.min(Math.max(Number(dpr) || 1, 1), 3)
  let width = Math.max(1, Math.round(Math.max(1, cssWidth) * ratio))
  let height = Math.max(1, Math.round(Math.max(1, cssHeight) * ratio))
  const maxSide = 4096
  const side = Math.max(width, height)
  if (side > maxSide) {
    const fit = maxSide / side
    width = Math.max(1, Math.round(width * fit))
    height = Math.max(1, Math.round(height * fit))
  }
  const maxArea = 16777216
  if (width * height > maxArea) {
    const fit = Math.sqrt(maxArea / (width * height))
    width = Math.max(1, Math.round(width * fit))
    height = Math.max(1, Math.round(height * fit))
  }
  return { width, height }
}

export function sizeCanvasToContainer(canvas, container) {
  const dpr = window.devicePixelRatio || 1
  const rect = (canvas || container).getBoundingClientRect()
  const cssWidth = Math.max(1, rect.width)
  const cssHeight = Math.max(1, rect.height)
  const next = backingSize(cssWidth, cssHeight, dpr)
  const resized = canvas.width !== next.width || canvas.height !== next.height

  if (resized) {
    canvas.width = next.width
    canvas.height = next.height
  }

  canvas.style.width = "100%"
  canvas.style.height = "100%"

  const ctx = canvas.getContext("2d")
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  return {
    ctx,
    width: canvas.width,
    height: canvas.height,
    cssWidth,
    cssHeight,
    resized,
    dpr,
    ready: cssWidth > 8 && cssHeight > 8,
  }
}

export function sourceSize(source) {
  const width = source?.naturalWidth || source?.width || 0
  const height = source?.naturalHeight || source?.height || 0
  return { width, height }
}

export function coverSourceRect(srcW, srcH, dstW, dstH) {
  const canvasRatio = dstW / Math.max(1, dstH)
  const imageRatio = srcW / Math.max(1, srcH)
  let sx = 0
  let sy = 0
  let sw = srcW
  let sh = srcH
  if (imageRatio > canvasRatio) {
    sw = srcH * canvasRatio
    sx = (srcW - sw) / 2
  } else {
    sh = srcW / canvasRatio
    sy = (srcH - sh) / 2
  }
  return { sx, sy, sw, sh }
}

export function containDestRect(srcW, srcH, dstW, dstH) {
  const scale = Math.min(dstW / Math.max(1, srcW), dstH / Math.max(1, srcH))
  const dw = Math.max(1, srcW * scale)
  const dh = Math.max(1, srcH * scale)
  return {
    dx: (dstW - dw) / 2,
    dy: (dstH - dh) / 2,
    dw,
    dh,
  }
}

export const DEFAULT_IMAGE_VIEW = { scale: 1, u: 0.5, v: 0.5 }

export function viewDestRect(srcW, srcH, dstW, dstH, view = DEFAULT_IMAGE_VIEW) {
  const base = containDestRect(srcW, srcH, dstW, dstH)
  const scale = Math.min(6, Math.max(1, view?.scale || 1))
  const dw = base.dw * scale
  const dh = base.dh * scale
  const u = Number.isFinite(view?.u) ? view.u : 0.5
  const v = Number.isFinite(view?.v) ? view.v : 0.5
  return {
    dx: dstW / 2 - u * dw,
    dy: dstH / 2 - v * dh,
    dw,
    dh,
    scale,
  }
}

export function clampImageView(view, srcW, srcH, dstW, dstH) {
  const scale = Math.min(6, Math.max(1, view?.scale || 1))
  if (scale <= 1.001) return { ...DEFAULT_IMAGE_VIEW }
  const base = containDestRect(srcW, srcH, dstW, dstH)
  const dw = base.dw * scale
  const dh = base.dh * scale
  const limit = (canvasSize, imageSize) => {
    const minPan = canvasSize * 0.22 - imageSize
    const maxPan = canvasSize * 0.78
    return { minPan, maxPan }
  }
  const xLimit = limit(dstW, dw)
  const yLimit = limit(dstH, dh)
  let panX = dstW / 2 - (view?.u ?? 0.5) * dw
  let panY = dstH / 2 - (view?.v ?? 0.5) * dh
  panX = Math.min(xLimit.maxPan, Math.max(xLimit.minPan, panX))
  panY = Math.min(yLimit.maxPan, Math.max(yLimit.minPan, panY))
  return {
    scale,
    u: (dstW / 2 - panX) / dw,
    v: (dstH / 2 - panY) / dh,
  }
}

export function drawImageCover(ctx, source, width, height) {
  const { width: imageWidth, height: imageHeight } = sourceSize(source)
  if (!imageWidth || !imageHeight) return
  const { sx, sy, sw, sh } = coverSourceRect(imageWidth, imageHeight, width, height)
  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
}

export function drawImageContain(ctx, source, width, height, fill = "#11110f") {
  const { width: imageWidth, height: imageHeight } = sourceSize(source)
  if (!imageWidth || !imageHeight) return
  const { dx, dy, dw, dh } = containDestRect(imageWidth, imageHeight, width, height)
  ctx.fillStyle = fill
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, imageWidth, imageHeight, dx, dy, dw, dh)
}

export function rasterizeSource(source, maxSide = 768) {
  const { width: iw, height: ih } = sourceSize(source)
  if (!iw || !ih) return null
  const scale = Math.min(1, maxSide / Math.max(iw, ih))
  const width = Math.max(1, Math.round(iw * scale))
  const height = Math.max(1, Math.round(ih * scale))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx.fillStyle = "#efe8dc"
  ctx.fillRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

export function rasterizeCover(source, width, height) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  ctx.fillStyle = "#efe8dc"
  ctx.fillRect(0, 0, width, height)
  if (source) drawImageCover(ctx, source, width, height)
  return ctx.getImageData(0, 0, width, height)
}

export function eventClientXY(event) {
  const native = event?.nativeEvent && typeof event.nativeEvent === "object"
    ? event.nativeEvent
    : event
  const touch =
    native?.touches?.[0] ||
    native?.changedTouches?.[0] ||
    event?.touches?.[0] ||
    event?.changedTouches?.[0]
  const clientX = Number(touch?.clientX ?? event?.clientX ?? native?.clientX)
  const clientY = Number(touch?.clientY ?? event?.clientY ?? native?.clientY)
  return {
    clientX: Number.isFinite(clientX) ? clientX : 0,
    clientY: Number.isFinite(clientY) ? clientY : 0,
  }
}

export function isTouchLikeEvent(event) {
  if (event?.pointerType === "touch") return true
  if (event?.pointerType === "mouse" || event?.pointerType === "pen") return false
  return Boolean(
    event?.touches?.length ||
      event?.changedTouches?.length ||
      event?.nativeEvent?.touches?.length ||
      event?.nativeEvent?.changedTouches?.length,
  )
}

export function eventCanvas(event, fallback = null) {
  const node = event?.currentTarget || event?.target || fallback
  if (node?.tagName === "CANVAS") return node
  return node?.closest?.("canvas") || fallback
}

export function clientPointToBitmap(clientX, clientY, rect, bitmapWidth, bitmapHeight, offset = { x: 0, y: 0 }) {
  if (!rect?.width || !rect?.height || !bitmapWidth || !bitmapHeight) return null
  const nx = (clientX - rect.left + (offset.x || 0)) / rect.width
  const ny = (clientY - rect.top + (offset.y || 0)) / rect.height
  if (nx < -0.001 || ny < -0.001 || nx > 1.001 || ny > 1.001) return null
  return {
    x: Math.min(bitmapWidth - 0.001, Math.max(0, nx) * bitmapWidth),
    y: Math.min(bitmapHeight - 0.001, Math.max(0, ny) * bitmapHeight),
  }
}

function viewportOffset() {
  const viewport = typeof window !== "undefined" ? window.visualViewport : null
  return { x: viewport?.offsetLeft || 0, y: viewport?.offsetTop || 0 }
}

export function pointerToCanvasPixels(event, canvas) {
  const el = eventCanvas(event, canvas)
  if (!el) return { x: 0, y: 0 }
  const rect = el.getBoundingClientRect()
  const targetIsCanvas = event?.target === el || event?.currentTarget === el
  if (targetIsCanvas && Number.isFinite(event?.offsetX) && Number.isFinite(event?.offsetY) && rect.width && rect.height) {
    return {
      x: Math.min(el.width - 0.001, Math.max(0, (event.offsetX / rect.width) * el.width)),
      y: Math.min(el.height - 0.001, Math.max(0, (event.offsetY / rect.height) * el.height)),
    }
  }
  const { clientX, clientY } = eventClientXY(event)
  return (
    clientPointToBitmap(clientX, clientY, rect, el.width, el.height, viewportOffset()) || { x: 0, y: 0 }
  )
}

export function canvasEventToImagePoint(event, canvas, imageWidth, imageHeight, view) {
  const point = pointerToWorkingPoint(event, canvas, imageWidth, imageHeight, {
    fit: "contain",
    view,
  })
  if (!point || !imageWidth || !imageHeight) return null
  const x = Math.max(0, Math.min(imageWidth - 1, Math.round(point.x)))
  const y = Math.max(0, Math.min(imageHeight - 1, Math.round(point.y)))
  return { x, y, index: y * imageWidth + x }
}

export function pointerToWorkingPoint(event, canvas, workW, workH, options = {}) {
  const el = eventCanvas(event, canvas)
  if (!el || !workW || !workH) return { x: 0, y: 0 }
  const { clientX, clientY } = eventClientXY(event)
  const rect = el.getBoundingClientRect()
  const bitmap = clientPointToBitmap(clientX, clientY, rect, el.width, el.height, viewportOffset())
  if (!bitmap) return null
  const nx = bitmap.x / el.width
  const ny = bitmap.y / el.height
  if (options.fit === "contain") {
    const { dx, dy, dw, dh } = options.view
      ? viewDestRect(workW, workH, el.width, el.height, options.view)
      : containDestRect(workW, workH, el.width, el.height)
    const px = bitmap.x
    const py = bitmap.y
    if (px < dx || py < dy || px > dx + dw || py > dy + dh) return null
    return {
      x: Math.min(workW - 0.001, Math.max(0, ((px - dx) / dw) * workW)),
      y: Math.min(workH - 0.001, Math.max(0, ((py - dy) / dh) * workH)),
    }
  }
  const { sx, sy, sw, sh } = coverSourceRect(workW, workH, el.width, el.height)
  return {
    x: Math.min(workW - 0.001, Math.max(0, sx + nx * sw)),
    y: Math.min(workH - 0.001, Math.max(0, sy + ny * sh)),
  }
}

export function disposeImageSource(source) {
  if (!source) return
  if (typeof source.close === "function") {
    try {
      source.close()
    } catch {
      // already closed
    }
  }
  if (source._objectUrl) {
    URL.revokeObjectURL(source._objectUrl)
    source._objectUrl = ""
  }
}

export async function loadImageSource(file) {
  const url = URL.createObjectURL(file)
  try {
    if (typeof createImageBitmap === "function") {
      try {
        const bitmap = await createImageBitmap(file, {
          imageOrientation: "from-image",
        })
        URL.revokeObjectURL(url)
        return bitmap
      } catch {
        // keep blob URL for <img> fallback
      }
    }

    const image = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."))
      el.src = url
    })
    if (typeof image.decode === "function") {
      try {
        await image.decode()
      } catch {
        // decode is optional; onload already succeeded
      }
    }
    image._objectUrl = url
    return image
  } catch (error) {
    URL.revokeObjectURL(url)
    throw error
  }
}

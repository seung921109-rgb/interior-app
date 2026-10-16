export function sizeCanvasToContainer(canvas, container) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const rect = (canvas || container).getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const nextWidth = Math.round(width * dpr)
  const nextHeight = Math.round(height * dpr)
  const resized = canvas.width !== nextWidth || canvas.height !== nextHeight

  if (resized) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }

  canvas.style.width = "100%"
  canvas.style.height = "100%"

  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width, height, resized, dpr, ready: width > 8 && height > 8 }
}

export function sourceSize(source) {
  const width = source?.naturalWidth || source?.width || 0
  const height = source?.naturalHeight || source?.height || 0
  return { width, height }
}

export function drawImageCover(ctx, source, width, height) {
  const { width: imageWidth, height: imageHeight } = sourceSize(source)
  if (!imageWidth || !imageHeight) return

  const canvasRatio = width / height
  const imageRatio = imageWidth / imageHeight

  let sx = 0
  let sy = 0
  let sw = imageWidth
  let sh = imageHeight

  if (imageRatio > canvasRatio) {
    sw = imageHeight * canvasRatio
    sx = (imageWidth - sw) / 2
  } else {
    sh = imageWidth / canvasRatio
    sy = (imageHeight - sh) / 2
  }

  ctx.clearRect(0, 0, width, height)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = "high"
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, width, height)
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

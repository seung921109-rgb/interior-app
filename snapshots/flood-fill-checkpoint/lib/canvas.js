export function sizeCanvasToContainer(canvas, container) {
  const dpr = Math.min(window.devicePixelRatio || 1, 3)
  const rect = container.getBoundingClientRect()
  const width = Math.max(1, Math.round(rect.width))
  const height = Math.max(1, Math.round(rect.height))
  const nextWidth = Math.round(width * dpr)
  const nextHeight = Math.round(height * dpr)
  const resized = canvas.width !== nextWidth || canvas.height !== nextHeight

  if (resized) {
    canvas.width = nextWidth
    canvas.height = nextHeight
  }

  canvas.style.width = `${width}px`
  canvas.style.height = `${height}px`

  const ctx = canvas.getContext("2d")
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return { ctx, width, height, resized, dpr }
}

export function drawImageCover(ctx, source, width, height) {
  const imageWidth = source.width
  const imageHeight = source.height
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

export async function loadImageSource(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" })
    } catch {
      // fall through to HTMLImageElement
    }
  }

  const url = URL.createObjectURL(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error("이미지를 불러오지 못했습니다."))
      el.src = url
    })
    return image
  } finally {
    URL.revokeObjectURL(url)
  }
}

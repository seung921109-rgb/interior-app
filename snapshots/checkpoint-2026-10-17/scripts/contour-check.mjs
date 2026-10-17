import { register } from "node:module"

register(new URL("./alias-loader.mjs", import.meta.url).href, import.meta.url)

const { buildLabBuffer, floodFill, refineSelection, sobelMagnitude } = await import(
  "../lib/smartMask.js"
)

function makeScene() {
  const width = 160
  const height = 160
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      let r = 242
      let g = 234
      let b = 218
      const inside = x >= 40 && x < 120 && y >= 40 && y < 120
      const rim = inside && (x < 42 || x >= 118 || y < 42 || y >= 118)
      if (inside) {
        r = 226
        g = 208
        b = 178
      }
      if (rim) {
        r = 148
        g = 126
        b = 96
      }
      if (x >= 68 && x < 76 && y >= 68 && y < 76) {
        r = 250
        g = 248
        b = 242
      }
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

function makeWardrobeScene() {
  const width = 160
  const height = 160
  const data = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      let r = 244
      let g = 236
      let b = 222
      const cabinet = x >= 36 && x < 118 && y >= 32 && y < 128
      if (cabinet) {
        r = 226
        g = 224
        b = 220
      }
      if (cabinet && x >= 116) {
        r = 210
        g = 206
        b = 200
      }
      data[i] = r
      data[i + 1] = g
      data[i + 2] = b
      data[i + 3] = 255
    }
  }
  return { width, height, data }
}

function at(mask, width, x, y) {
  return mask[y * width + x]
}

const imageData = makeScene()
const labs = buildLabBuffer(imageData)
const extra = floodFill(labs, 160, 160, 80, 80, 26, {
  edgeMag: sobelMagnitude(imageData),
})
const refined = refineSelection(imageData, labs, extra)
const painted = new Uint8Array(160 * 160)
painted[72 * 160 + 72] = 255
const kept = refineSelection(imageData, labs, extra, null, { preserve: painted })

const checks = {
  interior: at(refined, 160, 80, 80) > 128,
  wall: at(refined, 160, 10, 10) <= 128,
  justOutside: at(refined, 160, 36, 80) <= 128,
  justInside: at(refined, 160, 46, 80) > 128,
  highlightHole: at(refined, 160, 72, 72) > 128,
  paintKept: at(kept, 160, 72, 72) > 128,
}

const wardrobe = makeWardrobeScene()
const wLabs = buildLabBuffer(wardrobe)
const leaked = new Uint8Array(160 * 160)
for (let y = 36; y < 124; y++) {
  for (let x = 40; x < 142; x++) leaked[y * 160 + x] = 255
}
const clipped = refineSelection(wardrobe, wLabs, leaked)
checks.cabinetBody = at(clipped, 160, 80, 80) > 128
checks.rightWall = at(clipped, 160, 132, 80) <= 128
checks.rightEdge = at(clipped, 160, 114, 80) > 128

console.log(JSON.stringify(checks))
if (Object.values(checks).some((ok) => !ok)) {
  process.exit(1)
}

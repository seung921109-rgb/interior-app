export const TEXTURES = [
  { id: "oak", label: "오크 우드" },
  { id: "walnut", label: "월넛" },
  { id: "whiteoak", label: "화이트오크" },
  { id: "fabric", label: "패브릭" },
  { id: "marble", label: "대리석" },
  { id: "concrete", label: "콘크리트" },
]

function hash(x, y, seed) {
  const n = Math.sin(x * 127.1 + y * 311.7 + seed * 74.7) * 43758.5453
  return n - Math.floor(n)
}

function noise(x, y, seed) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const xf = x - xi
  const yf = y - yi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const n00 = hash(xi, yi, seed)
  const n10 = hash(xi + 1, yi, seed)
  const n01 = hash(xi, yi + 1, seed)
  const n11 = hash(xi + 1, yi + 1, seed)
  return (n00 * (1 - u) + n10 * u) * (1 - v) + (n01 * (1 - u) + n11 * u) * v
}

function fbm(x, y, seed) {
  return (
    noise(x, y, seed) * 0.5 +
    noise(x * 2, y * 2, seed + 1) * 0.25 +
    noise(x * 4, y * 4, seed + 2) * 0.125
  )
}

function put(data, i, r, g, b) {
  data[i] = r
  data[i + 1] = g
  data[i + 2] = b
  data[i + 3] = 255
}

export function makeTexture(id, size = 256) {
  const image = new ImageData(size, size)
  const { data } = image
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      const nx = x / size
      const ny = y / size
      if (id === "oak" || id === "walnut" || id === "whiteoak") {
        const grain =
          fbm(nx * 3, ny * 28, 2) +
          Math.sin(ny * 40 + fbm(nx * 8, ny * 8, 5) * 2) * 0.08
        const v = 0.55 + grain * 0.45
        if (id === "oak") put(data, i, 176 * v, 132 * v, 78 * v)
        else if (id === "walnut") put(data, i, 92 * v, 58 * v, 36 * v)
        else put(data, i, 214 * v, 196 * v, 168 * v)
      } else if (id === "fabric") {
        const v = 0.7 + noise(x / 3, y / 3, 8) * 0.3
        const weave = ((x + y) % 4 === 0 ? 0.92 : 1) * v
        put(data, i, 210 * weave, 198 * weave, 186 * weave)
      } else if (id === "marble") {
        const n = fbm(nx * 6, ny * 6, 3)
        const vein = Math.abs(Math.sin(nx * 8 + n * 6))
        const v = 0.86 + n * 0.12 - (vein > 0.92 ? 0.25 : 0)
        put(data, i, 236 * v, 232 * v, 226 * v)
      } else {
        const v = 0.55 + fbm(nx * 12, ny * 12, 7) * 0.45
        put(data, i, 150 * v, 148 * v, 144 * v)
      }
    }
  }
  return image
}

const cache = new Map()

export function getTexture(id) {
  let texture = cache.get(id)
  if (!texture) {
    texture = makeTexture(id)
    cache.set(id, texture)
  }
  return texture
}

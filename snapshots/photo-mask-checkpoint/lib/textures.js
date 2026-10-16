export const TEXTURES = [
  { id: "oak", label: "오크 우드", group: "우드 필름" },
  { id: "walnut", label: "월넛", group: "우드 필름" },
  { id: "whiteoak", label: "화이트오크", group: "우드 필름" },
  { id: "teak", label: "티크", group: "우드 필름" },
  { id: "herringbone", label: "헤링본", group: "우드 필름" },
  { id: "marble", label: "카라라 대리석", group: "석재 필름" },
  { id: "travertine", label: "트라버틴", group: "석재 필름" },
  { id: "concrete", label: "콘크리트", group: "석재 필름" },
  { id: "fabric", label: "린넨 패브릭", group: "패브릭" },
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
      if (id === "oak" || id === "walnut" || id === "whiteoak" || id === "teak") {
        const grain =
          fbm(nx * 3, ny * 28, 2) +
          Math.sin(ny * 40 + fbm(nx * 8, ny * 8, 5) * 2) * 0.08
        const v = 0.55 + grain * 0.45
        if (id === "oak") put(data, i, 176 * v, 132 * v, 78 * v)
        else if (id === "walnut") put(data, i, 92 * v, 58 * v, 36 * v)
        else if (id === "teak") put(data, i, 148 * v, 96 * v, 48 * v)
        else put(data, i, 214 * v, 196 * v, 168 * v)
      } else if (id === "herringbone") {
        const cell = 18
        const cx = Math.floor(x / cell)
        const cy = Math.floor(y / cell)
        const lx = x - cx * cell
        const ly = y - cy * cell
        const flip = (cx + cy) % 2 === 0
        const u = (flip ? lx : ly) / cell
        const vdir = (flip ? ly : lx) / cell
        const grain = fbm(u * 2, vdir * 16, 4)
        const seam = lx < 1 || ly < 1 ? 0.82 : 1
        const v = (0.52 + grain * 0.48) * seam
        put(data, i, 170 * v, 122 * v, 72 * v)
      } else if (id === "fabric") {
        const v = 0.7 + noise(x / 3, y / 3, 8) * 0.3
        const weave = ((x + y) % 4 === 0 ? 0.92 : 1) * v
        put(data, i, 210 * weave, 198 * weave, 186 * weave)
      } else if (id === "marble") {
        const n = fbm(nx * 6, ny * 6, 3)
        const vein = Math.abs(Math.sin(nx * 8 + n * 6))
        const v = 0.86 + n * 0.12 - (vein > 0.92 ? 0.25 : 0)
        put(data, i, 236 * v, 232 * v, 226 * v)
      } else if (id === "travertine") {
        const n = fbm(nx * 5, ny * 7, 9)
        const pit = noise(nx * 28, ny * 28, 11) > 0.82 ? 0.18 : 0
        const v = 0.78 + n * 0.16 - pit
        put(data, i, 228 * v, 210 * v, 186 * v)
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

const BINS = 28
const GRID = 30
const MIN_PIXELS = 48

function clamp(value, lo, hi) {
  return value < lo ? lo : value > hi ? hi : value
}

function fitLine(xs, ys) {
  const n = xs.length
  let sx = 0
  let sy = 0
  let sxx = 0
  let sxy = 0
  for (let i = 0; i < n; i++) {
    sx += xs[i]
    sy += ys[i]
    sxx += xs[i] * xs[i]
    sxy += xs[i] * ys[i]
  }
  const den = n * sxx - sx * sx
  if (n < 2 || Math.abs(den) < 1e-4) return { a: n ? sy / n : 0, b: 0 }
  const b = (n * sxy - sx * sy) / den
  return { a: (sy - b * sx) / n, b }
}

function solve3(matrix, rhs) {
  const m = matrix.slice()
  const x = rhs.slice()
  for (let col = 0; col < 3; col++) {
    let pivot = col
    for (let row = col + 1; row < 3; row++) {
      if (Math.abs(m[row * 3 + col]) > Math.abs(m[pivot * 3 + col])) pivot = row
    }
    for (let c = col; c < 3; c++) {
      const swap = m[col * 3 + c]
      m[col * 3 + c] = m[pivot * 3 + c]
      m[pivot * 3 + c] = swap
    }
    const swapB = x[col]
    x[col] = x[pivot]
    x[pivot] = swapB
    const div = m[col * 3 + col] || 1e-8
    for (let c = col; c < 3; c++) m[col * 3 + c] /= div
    x[col] /= div
    for (let row = 0; row < 3; row++) {
      if (row === col) continue
      const factor = m[row * 3 + col]
      if (!factor) continue
      for (let c = col; c < 3; c++) m[row * 3 + c] -= factor * m[col * 3 + c]
      x[row] -= factor * x[col]
    }
  }
  return x
}

function project(x, y, frame) {
  const dx = x - frame.mx
  const dy = y - frame.my
  return {
    pu: dx * frame.ax + dy * frame.ay,
    pv: dx * frame.bx + dy * frame.by,
  }
}

export function fitSurfaceFrame(mask, width, height) {
  let count = 0
  let sx = 0
  let sy = 0
  let sxx = 0
  let syy = 0
  let sxy = 0
  let minX = width
  let minY = height
  let maxX = 0
  let maxY = 0
  for (let y = 0; y < height; y++) {
    const row = y * width
    for (let x = 0; x < width; x++) {
      if (mask[row + x] < 24) continue
      count++
      sx += x
      sy += y
      sxx += x * x
      syy += y * y
      sxy += x * y
      if (x < minX) minX = x
      if (y < minY) minY = y
      if (x > maxX) maxX = x
      if (y > maxY) maxY = y
    }
  }
  if (count < MIN_PIXELS) return null

  const mx = sx / count
  const my = sy / count
  const cxx = sxx / count - mx * mx
  const cyy = syy / count - my * my
  const cxy = sxy / count - mx * my
  const angle = 0.5 * Math.atan2(2 * cxy, cxx - cyy)
  let ax = Math.cos(angle)
  let ay = Math.sin(angle)
  let bx = -ay
  let by = ax
  if (Math.abs(ay) > Math.abs(ax)) {
    const tx = ax
    const ty = ay
    ax = bx
    ay = by
    bx = tx
    by = ty
  }
  if (ax < 0) {
    ax = -ax
    ay = -ay
  }
  if (by < 0) {
    bx = -bx
    by = -by
  }

  const frame = { mx, my, ax, ay, bx, by, minX, minY, maxX, maxY }
  let puMin = Infinity
  let puMax = -Infinity
  let pvMin = Infinity
  let pvMax = -Infinity
  for (let y = minY; y <= maxY; y++) {
    const row = y * width
    for (let x = minX; x <= maxX; x++) {
      if (mask[row + x] < 24) continue
      const { pu, pv } = project(x, y, frame)
      if (pu < puMin) puMin = pu
      if (pu > puMax) puMax = pu
      if (pv < pvMin) pvMin = pv
      if (pv > pvMax) pvMax = pv
    }
  }

  const lo = new Float64Array(BINS).fill(Infinity)
  const hi = new Float64Array(BINS).fill(-Infinity)
  const bins = new Uint32Array(BINS)
  const spanV = Math.max(1e-3, pvMax - pvMin)
  for (let y = minY; y <= maxY; y++) {
    const row = y * width
    for (let x = minX; x <= maxX; x++) {
      if (mask[row + x] < 24) continue
      const { pu, pv } = project(x, y, frame)
      const bin = clamp(Math.floor(((pv - pvMin) / spanV) * BINS), 0, BINS - 1)
      bins[bin]++
      if (pu < lo[bin]) lo[bin] = pu
      if (pu > hi[bin]) hi[bin] = pu
    }
  }

  const ts = []
  const lefts = []
  const rights = []
  for (let i = 0; i < BINS; i++) {
    if (bins[i] < 4) continue
    ts.push((i + 0.5) / BINS)
    lefts.push(lo[i])
    rights.push(hi[i])
  }
  if (ts.length < 4) return null

  let left = fitLine(ts, lefts)
  let right = fitLine(ts, rights)
  const spanAt = (edgeL, edgeR, t) => edgeR.a + edgeR.b * t - (edgeL.a + edgeL.b * t)
  if (spanAt(left, right, 0) < 0 && spanAt(left, right, 1) < 0) {
    const swap = left
    left = right
    right = swap
  }

  const span0 = spanAt(left, right, 0)
  const span1 = spanAt(left, right, 1)
  const spanS = Math.max(8, (Math.abs(span0) + Math.abs(span1)) / 2)
  const spanT = Math.max(8, pvMax - pvMin)
  const fitted = {
    ...frame,
    pv0: pvMin,
    pv1: pvMax,
    pu0: puMin,
    pu1: puMax,
    leftA: left.a,
    leftB: left.b,
    rightA: right.a,
    rightB: right.b,
    span0,
    span1,
    spanS,
    spanT,
  }
  fitted.hinv = planeHomography(mask, width, height, fitted)
  return fitted
}

function imageFromPlane(frame, pu, pv) {
  return {
    x: frame.mx + pu * frame.ax + pv * frame.bx,
    y: frame.my + pu * frame.ay + pv * frame.by,
  }
}

function quadArea(tl, tr, br, bl) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  return Math.abs(cross(tl, tr, br)) + Math.abs(cross(tl, br, bl))
}

function sameTurn(tl, tr, br, bl) {
  const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)
  const turns = [cross(tl, tr, br), cross(tr, br, bl), cross(br, bl, tl), cross(bl, tl, tr)]
  const sign = turns.find((value) => Math.abs(value) > 1)
  if (!sign) return false
  return turns.every((value) => value * sign >= -1)
}

function invert3(m) {
  const c00 = m[4] * m[8] - m[5] * m[7]
  const c01 = m[5] * m[6] - m[3] * m[8]
  const c02 = m[3] * m[7] - m[4] * m[6]
  const c10 = m[7] * m[2] - m[8] * m[1]
  const c11 = m[8] * m[0] - m[6] * m[2]
  const c12 = m[6] * m[1] - m[7] * m[0]
  const c20 = m[1] * m[5] - m[2] * m[4]
  const c21 = m[2] * m[3] - m[0] * m[5]
  const c22 = m[0] * m[4] - m[1] * m[3]
  const det = m[0] * c00 + m[1] * c01 + m[2] * c02
  if (Math.abs(det) < 1e-8) return null
  const inv = 1 / det
  return [
    c00 * inv, c10 * inv, c20 * inv,
    c01 * inv, c11 * inv, c21 * inv,
    c02 * inv, c12 * inv, c22 * inv,
  ]
}

function solve8(matrix, rhs) {
  const m = matrix.map((row) => row.slice())
  const x = rhs.slice()
  for (let col = 0; col < 8; col++) {
    let pivot = col
    for (let row = col + 1; row < 8; row++) {
      if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row
    }
    if (Math.abs(m[pivot][col]) < 1e-10) return null
    const swapRow = m[col]
    m[col] = m[pivot]
    m[pivot] = swapRow
    const swapB = x[col]
    x[col] = x[pivot]
    x[pivot] = swapB
    const div = m[col][col]
    for (let c = col; c < 8; c++) m[col][c] /= div
    x[col] /= div
    for (let row = 0; row < 8; row++) {
      if (row === col) continue
      const factor = m[row][col]
      if (!factor) continue
      for (let c = col; c < 8; c++) m[row][c] -= factor * m[col][c]
      x[row] -= factor * x[col]
    }
  }
  return x
}

function homographyToQuad(tl, tr, br, bl) {
  const src = [
    [0, 0, tl],
    [1, 0, tr],
    [1, 1, br],
    [0, 1, bl],
  ]
  const matrix = []
  const rhs = []
  for (const [s, t, point] of src) {
    matrix.push([s, t, 1, 0, 0, 0, -point.x * s, -point.x * t])
    rhs.push(point.x)
    matrix.push([0, 0, 0, s, t, 1, -point.y * s, -point.y * t])
    rhs.push(point.y)
  }
  const h = solve8(matrix, rhs)
  if (!h) return null
  return invert3([h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1])
}

function cornerCluster(points, su, sv, slack) {
  let best = -Infinity
  for (const point of points) {
    const score = su * point.pu + sv * point.pv
    if (score > best) best = score
  }
  let count = 0
  let x = 0
  let y = 0
  for (const point of points) {
    const score = su * point.pu + sv * point.pv
    if (score < best - slack) continue
    count++
    x += point.x
    y += point.y
  }
  if (!count) return null
  return { x: x / count, y: y / count }
}

function planeHomography(mask, width, height, frame) {
  const points = []
  for (let y = frame.minY; y <= frame.maxY; y++) {
    const row = y * width
    for (let x = frame.minX; x <= frame.maxX; x++) {
      if (mask[row + x] < 24) continue
      const outside =
        x === frame.minX ||
        y === frame.minY ||
        x === frame.maxX ||
        y === frame.maxY ||
        mask[row + x - 1] < 24 ||
        mask[row + x + 1] < 24 ||
        mask[row - width + x] < 24 ||
        mask[row + width + x] < 24
      if (!outside) continue
      const projected = project(x, y, frame)
      points.push({ x, y, pu: projected.pu, pv: projected.pv })
    }
  }
  const slack = Math.max(3, Math.min(frame.spanS, frame.spanT) * 0.035)
  const tl = cornerCluster(points, -1, -1, slack)
  const tr = cornerCluster(points, 1, -1, slack)
  const bl = cornerCluster(points, -1, 1, slack)
  const br = cornerCluster(points, 1, 1, slack)
  const corners = tl && tr && bl && br ? [tl, tr, br, bl] : null
  const quad =
    corners && quadArea(tl, tr, br, bl) > 80 && sameTurn(tl, tr, br, bl)
      ? corners
      : [
          imageFromPlane(frame, frame.leftA, frame.pv0),
          imageFromPlane(frame, frame.rightA, frame.pv0),
          imageFromPlane(frame, frame.rightA + frame.rightB, frame.pv1),
          imageFromPlane(frame, frame.leftA + frame.leftB, frame.pv1),
        ]
  const [topLeft, topRight, bottomRight, bottomLeft] = quad
  if (!sameTurn(topLeft, topRight, bottomRight, bottomLeft)) return null
  if (quadArea(topLeft, topRight, bottomRight, bottomLeft) < 80) return null
  return homographyToQuad(topLeft, topRight, bottomRight, bottomLeft)
}

export function surfaceLinearUV(x, y, frame) {
  const homography = frame.hinv
  if (homography) {
    const depth = homography[6] * x + homography[7] * y + homography[8]
    if (Math.abs(depth) > 1e-4) {
      return {
        s: (homography[0] * x + homography[1] * y + homography[2]) / depth,
        t: (homography[3] * x + homography[4] * y + homography[5]) / depth,
      }
    }
  }
  const { pu, pv } = project(x, y, frame)
  const tLin = (pv - frame.pv0) / (frame.pv1 - frame.pv0 || 1)
  const tc = clamp(tLin, 0, 1)
  let left = frame.leftA + frame.leftB * tc
  let right = frame.rightA + frame.rightB * tc
  let span = right - left
  const minSpan = Math.max(8, frame.spanS * 0.18)
  if (!(span > minSpan)) {
    const mid = (left + right) / 2
    left = mid - minSpan / 2
    right = mid + minSpan / 2
    span = minSpan
  }
  const s = (pu - left) / span
  const w0 = Math.max(8, frame.span0)
  const w1 = Math.max(8, frame.span1)
  let t = tc
  if (Math.abs(w1 - w0) > Math.max(w0, w1) * 0.06) {
    const w = Math.max(8, w0 + (w1 - w0) * tc)
    const denom = Math.log(w1 / w0)
    if (Math.abs(denom) > 1e-4) t = Math.log(w / w0) / denom
  }
  return { s, t }
}

function sampleGrid(grid, gs, s, t) {
  const x = clamp(s, 0, 1) * (gs - 1)
  const y = clamp(t, 0, 1) * (gs - 1)
  const x0 = Math.floor(x)
  const y0 = Math.floor(y)
  const x1 = Math.min(gs - 1, x0 + 1)
  const y1 = Math.min(gs - 1, y0 + 1)
  const fx = x - x0
  const fy = y - y0
  const row0 = y0 * gs
  const row1 = y1 * gs
  const top = grid[row0 + x0] * (1 - fx) + grid[row0 + x1] * fx
  const bot = grid[row1 + x0] * (1 - fx) + grid[row1 + x1] * fx
  return top * (1 - fy) + bot * fy
}

function boxBlur(src, gs) {
  const tmp = new Float32Array(src.length)
  for (let y = 0; y < gs; y++) {
    const row = y * gs
    for (let x = 0; x < gs; x++) {
      let acc = 0
      let n = 0
      for (let k = -1; k <= 1; k++) {
        const xx = x + k
        if (xx < 0 || xx >= gs) continue
        acc += src[row + xx]
        n++
      }
      tmp[row + x] = acc / n
    }
  }
  for (let x = 0; x < gs; x++) {
    for (let y = 0; y < gs; y++) {
      let acc = 0
      let n = 0
      for (let k = -1; k <= 1; k++) {
        const yy = y + k
        if (yy < 0 || yy >= gs) continue
        acc += tmp[yy * gs + x]
        n++
      }
      src[y * gs + x] = acc / n
    }
  }
}

function buildCurvature(photo, mask, width, height, frame) {
  const gs = GRID
  const sum = new Float64Array(gs * gs)
  const cnt = new Uint32Array(gs * gs)
  for (let y = frame.minY; y <= frame.maxY; y++) {
    const row = y * width
    for (let x = frame.minX; x <= frame.maxX; x++) {
      if (mask[row + x] < 24) continue
      const { s, t } = surfaceLinearUV(x, y, frame)
      const gx = clamp(Math.floor(clamp(s, 0, 0.999) * gs), 0, gs - 1)
      const gy = clamp(Math.floor(clamp(t, 0, 0.999) * gs), 0, gs - 1)
      const p = (row + x) * 4
      const luma = (0.2126 * photo[p] + 0.7152 * photo[p + 1] + 0.0722 * photo[p + 2]) / 255
      const i = gy * gs + gx
      sum[i] += luma
      cnt[i]++
    }
  }

  const heightField = new Float32Array(gs * gs)
  let mean = 0
  let seen = 0
  for (let i = 0; i < heightField.length; i++) {
    if (!cnt[i]) continue
    heightField[i] = sum[i] / cnt[i]
    mean += heightField[i]
    seen++
  }
  mean = seen ? mean / seen : 0.5
  for (let i = 0; i < heightField.length; i++) {
    if (!cnt[i]) heightField[i] = mean
  }
  boxBlur(heightField, gs)
  boxBlur(heightField, gs)

  let n = 0
  let ss = 0
  let st = 0
  let sh = 0
  let sss = 0
  let stt = 0
  let sst = 0
  let ssh = 0
  let sth = 0
  for (let i = 0; i < heightField.length; i++) {
    if (!cnt[i]) continue
    const s = (i % gs) / (gs - 1)
    const t = Math.floor(i / gs) / (gs - 1)
    const h = heightField[i]
    n++
    ss += s
    st += t
    sh += h
    sss += s * s
    stt += t * t
    sst += s * t
    ssh += s * h
    sth += t * h
  }
  const plane =
    n > 6
      ? solve3([n, ss, st, ss, sss, sst, st, sst, stt], [sh, ssh, sth])
      : [mean, 0, 0]
  const residual = new Float32Array(gs * gs)
  for (let gy = 0; gy < gs; gy++) {
    const tv = gy / (gs - 1)
    for (let gx = 0; gx < gs; gx++) {
      const sv = gx / (gs - 1)
      const i = gy * gs + gx
      residual[i] = heightField[i] - (plane[0] + plane[1] * sv + plane[2] * tv)
    }
  }

  const arcS = new Float32Array(gs * gs)
  const arcT = new Float32Array(gs * gs)
  for (let gy = 0; gy < gs; gy++) {
    const row = gy * gs
    let acc = 0
    arcS[row] = 0
    for (let gx = 1; gx < gs; gx++) {
      const dh = residual[row + gx] - residual[row + gx - 1]
      acc += Math.sqrt(1 + (dh * 16) ** 2)
      arcS[row + gx] = acc
    }
    const total = acc || 1
    for (let gx = 0; gx < gs; gx++) arcS[row + gx] /= total
  }
  for (let gx = 0; gx < gs; gx++) {
    let acc = 0
    arcT[gx] = 0
    for (let gy = 1; gy < gs; gy++) {
      const dh = residual[gy * gs + gx] - residual[(gy - 1) * gs + gx]
      acc += Math.sqrt(1 + (dh * 16) ** 2)
      arcT[gy * gs + gx] = acc
    }
    const total = acc || 1
    for (let gy = 0; gy < gs; gy++) arcT[gy * gs + gx] /= total
  }

  const dS = new Float32Array(gs * gs)
  const dT = new Float32Array(gs * gs)
  for (let gy = 0; gy < gs; gy++) {
    for (let gx = 0; gx < gs; gx++) {
      const left = residual[gy * gs + Math.max(0, gx - 1)]
      const right = residual[gy * gs + Math.min(gs - 1, gx + 1)]
      const up = residual[Math.max(0, gy - 1) * gs + gx]
      const down = residual[Math.min(gs - 1, gy + 1) * gs + gx]
      dS[gy * gs + gx] = right - left
      dT[gy * gs + gx] = down - up
    }
  }
  return { gs, arcS, arcT, dS, dT }
}

function fract(value) {
  return value - Math.floor(value)
}

function sampleRepeat(tex, texW, texH, u, v) {
  const uu = ((u % texW) + texW) % texW
  const vv = ((v % texH) + texH) % texH
  const x0 = Math.floor(uu)
  const y0 = Math.floor(vv)
  const x1 = (x0 + 1) % texW
  const y1 = (y0 + 1) % texH
  const fx = uu - x0
  const fy = vv - y0
  const i00 = (y0 * texW + x0) * 4
  const i10 = (y0 * texW + x1) * 4
  const i01 = (y1 * texW + x0) * 4
  const i11 = (y1 * texW + x1) * 4
  const w00 = (1 - fx) * (1 - fy)
  const w10 = fx * (1 - fy)
  const w01 = (1 - fx) * fy
  const w11 = fx * fy
  return [
    tex[i00] * w00 + tex[i10] * w10 + tex[i01] * w01 + tex[i11] * w11,
    tex[i00 + 1] * w00 + tex[i10 + 1] * w10 + tex[i01 + 1] * w01 + tex[i11 + 1] * w11,
    tex[i00 + 2] * w00 + tex[i10 + 2] * w10 + tex[i01 + 2] * w01 + tex[i11 + 2] * w11,
  ]
}

export function mapSurfaceTexture({
  photo,
  mask,
  width,
  height,
  tex,
  texW,
  texH,
  cell,
  alongGrain,
  grout,
}) {
  const frame = fitSurfaceFrame(mask, width, height)
  if (!frame) return null
  const field = buildCurvature(photo, mask, width, height, frame)
  const repeatS = Math.max(2, frame.spanS / Math.max(12, cell))
  const repeatT = Math.max(2, frame.spanT / Math.max(12, cell))
  const out = new Uint8ClampedArray(width * height * 4)
  const groutWidth = grout ? 0.042 : 0

  for (let y = frame.minY; y <= frame.maxY; y++) {
    const row = y * width
    for (let x = frame.minX; x <= frame.maxX; x++) {
      if (mask[row + x] < 24) continue
      const linear = surfaceLinearUV(x, y, frame)
      const s =
        sampleGrid(field.arcS, field.gs, linear.s, linear.t) +
        clamp(sampleGrid(field.dT, field.gs, linear.s, linear.t) * 4.2, -0.07, 0.07)
      const t =
        sampleGrid(field.arcT, field.gs, linear.s, linear.t) +
        clamp(sampleGrid(field.dS, field.gs, linear.s, linear.t) * 4.2, -0.07, 0.07)
      const texX = (alongGrain ? t * repeatT : s * repeatS) * texW
      const texY = (alongGrain ? s * repeatS : t * repeatT) * texH
      let [r, g, b] = sampleRepeat(tex, texW, texH, texX, texY)
      if (groutWidth) {
        const edge = Math.min(
          Math.min(fract(s * repeatS), 1 - fract(s * repeatS)),
          Math.min(fract(t * repeatT), 1 - fract(t * repeatT)),
        )
        if (edge < groutWidth) {
          const shade = 0.42 + 0.58 * (edge / groutWidth)
          r *= shade
          g *= shade
          b *= shade
        } else if (edge < groutWidth * 2.4) {
          const lift = 1 + 0.16 * (1 - (edge - groutWidth) / (groutWidth * 1.4))
          r = Math.min(255, r * lift)
          g = Math.min(255, g * lift)
          b = Math.min(255, b * lift)
        }
      }
      const p = (row + x) * 4
      out[p] = r
      out[p + 1] = g
      out[p + 2] = b
      out[p + 3] = 255
    }
  }
  return out
}

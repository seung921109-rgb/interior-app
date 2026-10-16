export function hexToRgb(hex) {
  const h = hex.replace("#", "")
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h
  const v = Number.parseInt(n, 16)
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 }
}

export function rgbToLab(r, g, b) {
  let R = r / 255
  let G = g / 255
  let B = b / 255
  R = R > 0.04045 ? ((R + 0.055) / 1.055) ** 2.4 : R / 12.92
  G = G > 0.04045 ? ((G + 0.055) / 1.055) ** 2.4 : G / 12.92
  B = B > 0.04045 ? ((B + 0.055) / 1.055) ** 2.4 : B / 12.92
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047
  const y = (R * 0.2126 + G * 0.7152 + B * 0.0722) / 1
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const fx = f(x)
  const fy = f(y)
  const fz = f(z)
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)]
}

export function labDist(a, b) {
  const dL = a[0] - b[0]
  const dA = a[1] - b[1]
  const dB = a[2] - b[2]
  return Math.sqrt(dL * dL + dA * dA + dB * dB)
}

export function luminance(r, g, b) {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function overlayChannel(base, blend) {
  return base < 128
    ? (2 * base * blend) / 255
    : 255 - (2 * (255 - base) * (255 - blend)) / 255
}

export function clampByte(n) {
  return n < 0 ? 0 : n > 255 ? 255 : n
}

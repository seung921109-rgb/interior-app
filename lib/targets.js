import { cloneMask, emptyMask, maskHasSelection, unionMask } from "@/lib/mask"

export function createTargetMeta(label, index) {
  return {
    id: `target-${index}`,
    label,
    index,
    hasMask: false,
    color: null,
    texture: null,
    appliedColor: null,
    appliedTexture: null,
  }
}

export function createTargetBuffer(label, index, length = 1) {
  return {
    id: `target-${index}`,
    label,
    index,
    mask: emptyMask(Math.max(1, length)),
    paint: emptyMask(Math.max(1, length)),
  }
}

export function resizeTargetBuffer(buffer, length) {
  const n = Math.max(1, length)
  if (buffer.mask.length !== n) buffer.mask = emptyMask(n)
  if (buffer.paint.length !== n) buffer.paint = emptyMask(n)
  return buffer
}

export function unionTargetMasks(buffers) {
  if (!buffers.length) return emptyMask(1)
  let out = cloneMask(buffers[0].mask)
  for (let i = 1; i < buffers.length; i++) {
    out = unionMask(out, buffers[i].mask)
  }
  return out
}

export function targetHasMask(buffer) {
  return maskHasSelection(buffer?.mask)
}

export function toFinishJobs(metas, buffers) {
  const byId = new Map(buffers.map((item) => [item.id, item]))
  return metas
    .map((meta) => {
      const buffer = byId.get(meta.id)
      const color = meta.color || meta.appliedColor
      const texture = meta.texture || meta.appliedTexture
      return {
        id: meta.id,
        label: meta.label,
        index: meta.index,
        mask: buffer?.mask || emptyMask(1),
        color: color || null,
        texture: texture || null,
      }
    })
    .filter((job) => (job.color || job.texture) && maskHasSelection(job.mask))
}

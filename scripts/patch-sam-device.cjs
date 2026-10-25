module.exports = function patchSamDevice(source) {
  const pattern =
    /if \(ORT_SYMBOL in globalThis\) \{\r?\n  ONNX = globalThis\[ORT_SYMBOL\];\r?\n\}/
  if (!pattern.test(source)) return source
  return source.replace(
    pattern,
    `if (ORT_SYMBOL in globalThis) {
  ONNX = globalThis[ORT_SYMBOL];
  supportedDevices.push("wasm");
  defaultDevices = ["wasm"];
}`,
  )
}

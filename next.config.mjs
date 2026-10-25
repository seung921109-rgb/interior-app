import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const transformersWeb = path.join(
  __dirname,
  "node_modules/@huggingface/transformers/dist/transformers.web.js",
)

const onnxWebStub = path.join(__dirname, "lib/onnx-web-stub.js")
const patchSamDevice = path.join(__dirname, "scripts/patch-sam-device.cjs")

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: [
      "@huggingface/transformers",
      "onnxruntime-node",
      "onnxruntime-web",
    ],
    esmExternals: "loose",
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    }

    config.module.rules.push({
      test: /onnxruntime-web[\\/].*\.mjs$/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
    })
    config.module.rules.push({
      test: /transformers\.web\.js$/,
      use: patchSamDevice,
    })

    if (config.optimization?.minimizer) {
      for (const plugin of config.optimization.minimizer) {
        if (plugin.constructor.name !== "TerserPlugin") continue
        const prev = plugin.options.exclude
        plugin.options.exclude = [
          ...(Array.isArray(prev) ? prev : prev ? [prev] : []),
          /onnxruntime-web/,
          /ort\.webgpu/,
          /ort-wasm/,
        ]
      }
    }

    if (isServer) {
      config.resolve.alias["@huggingface/transformers"] = false
      config.resolve.alias["onnxruntime-web"] = false
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        canvas: false,
      }
    } else {
      config.resolve.alias["@huggingface/transformers"] = transformersWeb
      config.resolve.alias["onnxruntime-web/webgpu"] = onnxWebStub
    }

    return config
  },
}

export default nextConfig

import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const transformersWeb = path.join(
  __dirname,
  "node_modules/@huggingface/transformers/dist/transformers.web.js",
)

const webgpuStub = path.join(__dirname, "lib/onnx-webgpu-stub.js")

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
  webpack: (config, { isServer, webpack }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
    }

    config.plugins.push(
      new webpack.NormalModuleReplacementPlugin(
        /onnxruntime-web[\\/].*ort\.webgpu/,
        webgpuStub,
      ),
    )

    config.module.rules.push({
      test: /onnxruntime-web[\\/].*\.mjs$/,
      type: "javascript/auto",
      resolve: { fullySpecified: false },
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
    }

    return config
  },
}

export default nextConfig

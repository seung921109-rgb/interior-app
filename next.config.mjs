import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      sharp$: false,
      "onnxruntime-node$": false,
      "@huggingface/transformers": path.join(
        __dirname,
        "node_modules/@huggingface/transformers/dist/transformers.web.js",
      ),
    }
    return config
  },
}

export default nextConfig

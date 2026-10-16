import { pathToFileURL } from "node:url"

const root = new URL("../", import.meta.url)

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    return nextResolve(new URL(`${specifier.slice(2)}.js`, root).href, context)
  }
  return nextResolve(specifier, context)
}

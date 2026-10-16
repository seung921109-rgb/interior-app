import { Suspense } from "react"

export default function LoginLayout({ children }) {
  return <Suspense fallback={null}>{children}</Suspense>
}

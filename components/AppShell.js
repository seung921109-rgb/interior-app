"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import Header from "@/components/Header"
import BottomTabBar from "@/components/BottomTabBar"
import ProcessingOverlay from "@/components/ProcessingOverlay"
import { AuthProvider } from "@/context/AuthContext"
import { PreviewProvider, usePreview } from "@/context/PreviewContext"

function ShellFrame({ children }) {
  const pathname = usePathname()
  const preview = usePreview()
  const immersive =
    preview.hasImage && (pathname === "/" || pathname === "/palette")

  useEffect(() => {
    const apply = () => {
      const height = window.visualViewport?.height || window.innerHeight
      document.documentElement.style.setProperty("--app-height", `${Math.round(height)}px`)
    }
    apply()
    window.visualViewport?.addEventListener("resize", apply)
    window.visualViewport?.addEventListener("scroll", apply)
    window.addEventListener("orientationchange", apply)
    return () => {
      window.visualViewport?.removeEventListener("resize", apply)
      window.visualViewport?.removeEventListener("scroll", apply)
      window.removeEventListener("orientationchange", apply)
    }
  }, [])

  return (
    <div className="app-shell relative flex w-full min-h-0 max-w-md flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_0_40px_rgba(28,24,20,0.18)] sm:border-x sm:border-black/10 md:max-w-4xl lg:max-w-6xl">
      {immersive ? null : <Header />}
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {immersive ? null : <BottomTabBar />}
      {preview.isProcessing ? (
        <ProcessingOverlay message={preview.processingMessage} />
      ) : null}
    </div>
  )
}

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <PreviewProvider>
        <ShellFrame>{children}</ShellFrame>
      </PreviewProvider>
    </AuthProvider>
  )
}

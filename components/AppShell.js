"use client"

import { usePathname } from "next/navigation"
import Header from "@/components/Header"
import BottomTabBar from "@/components/BottomTabBar"
import { AuthProvider } from "@/context/AuthContext"
import { PreviewProvider, usePreview } from "@/context/PreviewContext"

function ShellFrame({ children }) {
  const pathname = usePathname()
  const preview = usePreview()
  const immersive =
    preview.hasImage && (pathname === "/" || pathname === "/palette")

  return (
    <div className="app-shell flex w-full min-h-0 max-w-md flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_0_40px_rgba(28,24,20,0.18)] sm:border-x sm:border-black/10">
      {immersive ? null : <Header />}
      <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
      {immersive ? null : <BottomTabBar />}
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

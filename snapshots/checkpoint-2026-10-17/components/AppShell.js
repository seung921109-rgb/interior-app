"use client"

import Header from "@/components/Header"
import BottomTabBar from "@/components/BottomTabBar"
import { AuthProvider } from "@/context/AuthContext"
import { PreviewProvider } from "@/context/PreviewContext"

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <PreviewProvider>
        <div className="app-shell flex w-full min-h-0 max-w-md flex-col overflow-hidden bg-white pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] shadow-[0_0_40px_rgba(28,24,20,0.18)] sm:border-x sm:border-black/10">
          <Header />
          <main className="min-h-0 flex-1 overflow-hidden">{children}</main>
          <BottomTabBar />
        </div>
      </PreviewProvider>
    </AuthProvider>
  )
}

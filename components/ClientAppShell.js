"use client"

import dynamic from "next/dynamic"

const AppShell = dynamic(() => import("@/components/AppShell"), {
  ssr: false,
  loading: () => (
    <div className="app-shell flex w-full min-h-0 max-w-md flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-stone-500">
        불러오는 중...
      </div>
    </div>
  ),
})

export default function ClientAppShell({ children }) {
  return <AppShell>{children}</AppShell>
}

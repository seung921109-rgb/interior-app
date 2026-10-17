"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Download, ImageUp, Palette } from "lucide-react"
import { TABS } from "@/lib/tabs"

const ICONS = {
  "/": ImageUp,
  "/palette": Palette,
  "/save": Download,
}

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="주요 작업"
      className="shrink-0 border-t border-black/5 bg-white/95 shadow-tab backdrop-blur-md"
    >
      <ul className="grid grid-cols-3 px-1 pt-1 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {TABS.map((tab) => {
          const active = pathname === tab.href
          const Icon = ICONS[tab.href]

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 select-none flex-col items-center justify-center gap-0.5 rounded-xl px-1 py-1.5 text-[11px] font-medium leading-tight ${
                  active
                    ? "text-clay-600"
                    : "text-stone-500 active:bg-ink-50 active:text-ink-800"
                }`}
              >
                <Icon
                  aria-hidden
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.8}
                />
                <span className="max-w-full px-0.5 text-center">
                  {tab.label}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

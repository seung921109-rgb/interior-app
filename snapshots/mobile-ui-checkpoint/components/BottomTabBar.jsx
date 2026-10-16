"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ImagePlus, Palette, Download } from "lucide-react"

const tabs = [
  { href: "/", label: "사진 업로드", icon: ImagePlus },
  { href: "/palette", label: "컬러/텍스처 선택", icon: Palette },
  { href: "/save", label: "결과 저장", icon: Download },
]

export default function BottomTabBar() {
  const pathname = usePathname()

  return (
    <nav
      className="shrink-0 border-t border-black/10 bg-white/95 shadow-tab backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
      aria-label="하단 탭"
    >
      <ul className="grid grid-cols-3">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active =
            tab.href === "/"
              ? pathname === "/"
              : pathname.startsWith(tab.href)

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-1 px-2 py-2 text-[11px] font-medium leading-tight transition-colors ${
                  active
                    ? "text-clay-600"
                    : "text-stone-500 active:text-stone-700"
                }`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.8}
                  aria-hidden="true"
                />
                <span className="text-center">{tab.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

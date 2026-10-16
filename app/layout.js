import ClientAppShell from "@/components/ClientAppShell"
import "./globals.css"

export const metadata = {
  title: "인테리어 시뮬레이터 AI - 가구/타일 시뮬레이터",
  description: "사진 위에 가구와 타일을 미리 보는 모바일 인테리어 시뮬레이터",
  appleWebApp: {
    capable: true,
    title: "인테리어 시뮬레이터 AI",
    statusBarStyle: "black-translucent",
  },
  formatDetection: {
    telephone: false,
  },
}

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: "#1c1814",
}

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body className="flex justify-center overflow-hidden antialiased">
        <ClientAppShell>{children}</ClientAppShell>
      </body>
    </html>
  )
}

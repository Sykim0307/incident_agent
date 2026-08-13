import type { Metadata } from "next";
import Link from "next/link";
import NavLink from "@/components/NavLink";
import NavigationProgress from "@/components/NavigationProgress";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://incidentagent-five.vercel.app"),
  title: "Incident Response Copilot",
  description: "시스템 개발 및 운영 직군을 위한 24/7 장애 대응 지원 Agent",
  openGraph: {
    title: "Incident Response Copilot",
    description: "증권 IT 시스템을 위한 24/7 장애 대응 지원 Agent",
    siteName: "Incident Response Copilot",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Incident Response Copilot",
    description: "증권 IT 시스템을 위한 24/7 장애 대응 지원 Agent",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-ink">
        <NavigationProgress />
        <header className="border-b border-rule">
          <div className="mx-auto max-w-6xl px-6 py-4 flex items-center justify-between gap-6 flex-wrap">
            <Link href="/" className="flex flex-col gap-0.5">
              <span className="flex items-baseline gap-2">
                <span className="font-mono text-xs tracking-wide text-accent uppercase">
                  Incident Response
                </span>
                <span className="font-semibold text-xl">Copilot</span>
              </span>
              <span className="text-xs text-ink-faint">
                증권 IT 시스템을 위한 24/7 장애 대응 지원 Agent
              </span>
            </Link>
            <nav className="flex items-center gap-6 text-[15px] text-ink-soft">
              <NavLink href="/">24/7 관제센터</NavLink>
              <NavLink href="/incidents">장애 이력</NavLink>
              <NavLink href="/knowledge-base">과거 장애 사례</NavLink>
            </nav>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t border-rule">
          <div className="mx-auto max-w-6xl px-6 py-6 text-xs text-ink-faint">
            시스템 개발 및 운영 직군 · 장애 대응 지원 Agent 데모 · 모든 데이터는 샌드박스 모의 데이터입니다.
          </div>
        </footer>
      </body>
    </html>
  );
}

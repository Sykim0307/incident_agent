import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Incident Response Copilot",
  description: "시스템 개발 및 운영 직군을 위한 24/7 장애 대응 지원 Agent",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-bg text-ink">
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
              <Link href="/" className="hover:text-ink transition-colors">
                24/7 관제센터
              </Link>
              <Link href="/incidents" className="hover:text-ink transition-colors">
                장애 목록
              </Link>
              <Link href="/knowledge-base" className="hover:text-ink transition-colors">
                장애 지식베이스
              </Link>
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

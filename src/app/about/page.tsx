import Link from "next/link";

const FEATURES: { title: string; desc: string }[] = [
  {
    title: "24/7 실시간 관제",
    desc: "모의 시스템 로그를 실시간으로 감시하고, 시스템 헬스체크·자원 사용량까지 한 화면에서 확인합니다.",
  },
  {
    title: "장애 자동 감지·그룹핑",
    desc: "에러 로그에서 시그니처를 추출해 과거 사례와 TF-IDF 유사도로 비교하고, 같은 패턴은 하나의 카드로 묶어 보여줍니다.",
  },
  {
    title: "대응 체크리스트 자동 실행",
    desc: "장애별 대응 체크리스트를 제시하고, 사용자 승인 하에 검증·복구까지 자동으로 순서대로 실행합니다.",
  },
  {
    title: "테스트 검증 · 시스템 복구",
    desc: "조치 후 테스트 데이터로 정상 작동 여부를 확인하고, 샌드박스 데이터를 장애 발생 이전 상태로 되돌립니다.",
  },
  {
    title: "당직자 알림 (시뮬레이션)",
    desc: "장애 발생 시 담당 시스템의 당직자에게 SMS/이메일 알림을 시뮬레이션으로 발송하고 기록합니다.",
  },
  {
    title: "AI 로그 자동 분석",
    desc: "로그를 붙여넣거나 파일로 업로드하면 Agent의 분석 파이프라인이 실제로 동작하는지 바로 확인할 수 있습니다.",
  },
  {
    title: "장애조치 보고서",
    desc: "감지부터 조치·검증·복구·알림까지의 전체 내역을 종합한 보고서를 자동으로 생성합니다.",
  },
  {
    title: "지식베이스 학습 구조",
    desc: "해결된 장애는 과거 사례로 누적되어, 다음 유사 장애 대응 속도를 계속 높여갑니다.",
  },
];

export default function AboutPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-14 flex flex-col gap-14">
      <section className="flex flex-col gap-4">
        <span className="font-mono text-xs uppercase tracking-wide text-accent">
          Incident Response Copilot
        </span>
        <h1 className="text-3xl sm:text-4xl font-semibold leading-tight">
          증권 IT 시스템을 위한
          <br />
          24/7 장애 대응 지원 Agent
        </h1>
        <p className="text-sm text-ink-soft max-w-xl">
          계정계 원장·MTS 주문 같은 모의 증권 시스템에 로그를 흘려보내고, 이상이 감지되면
          Agent가 과거 사례와 비교해 원인을 추정하고, 대응 체크리스트를 제시하고, 조치
          완료 후 테스트 검증과 데이터 복구까지 수행합니다.
        </p>
        <div className="flex gap-3 mt-2">
          <Link
            href="/"
            className="rounded bg-accent text-white px-4 py-2 text-sm font-medium hover:opacity-90"
          >
            관제센터 바로가기 →
          </Link>
          <Link
            href="/knowledge-base"
            className="rounded border border-rule bg-surface px-4 py-2 text-sm font-medium hover:bg-surface-2"
          >
            과거 장애 사례 보기
          </Link>
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          핵심 기능
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="border border-rule rounded bg-surface p-4">
              <p className="text-sm font-medium">{f.title}</p>
              <p className="text-xs text-ink-soft mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          기술 스택
        </h2>
        <p className="text-sm text-ink-soft">
          Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres +
          Realtime + Auth) · Claude API (선택) · Vercel (배포 + Cron)
        </p>
      </section>

      <section className="flex flex-col gap-3 border border-rule rounded bg-surface p-4">
        <h2 className="font-mono text-xs uppercase tracking-wide text-ink-faint">
          안내
        </h2>
        <p className="text-sm text-ink-soft">
          시스템 개발 및 운영 직군을 위한 데모 프로젝트입니다. 화면의 모든 데이터(계좌,
          장애, 당직자 등)는 샌드박스 모의 데이터이며, 알림 발송은 시뮬레이션으로만
          동작합니다. 실제 고객 정보나 실제 발송은 발생하지 않습니다.
        </p>
      </section>
    </div>
  );
}

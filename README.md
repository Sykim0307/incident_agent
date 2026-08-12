# Incident Response Copilot

시스템 개발 및 운영 직군을 위한 24/7 장애 대응 지원 Agent.
삼성증권 IT 서비스 기획 및 운영 신입사원 과제 — 웹서비스 버전.

모의 증권 시스템(계정계 원장 / MTS 주문)에 로그를 흘려보내고, 이상 로그가 감지되면
Agent가 과거 장애 사례와 비교해 원인을 추정하고, 대응 체크리스트를 제시하고,
조치 완료 후 테스트 검증과 샌드박스 데이터 복구까지 수행합니다.

- 개발 경위와 각 기능이 왜 지금 형태인지는 [docs/DEV_LOG.md](docs/DEV_LOG.md)
- 구조/데이터 흐름은 [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- 이번 프로젝트에서 내린 주요 의사결정은 [docs/DECISIONS.md](docs/DECISIONS.md)
- 로컬 실행 · Supabase 연결 · 배포 절차는 [docs/SETUP.md](docs/SETUP.md)
- 최초 CLI 프로토타입(Python)은 [prototype-cli/](prototype-cli/)

## 기능

1. **24/7 관제 대시보드** — 모의 로그 스트림을 실시간(Supabase Realtime)으로 표시.
   자동 시뮬레이션(4초 간격) 또는 수동 트리거로 로그를 생성할 수 있습니다.
2. **장애 감지 · 유사 사례 검색** — 에러 시그니처를 추출하고, 과거 장애
   지식베이스와 TF-IDF 코사인 유사도로 비교해 가장 가까운 사례를 찾습니다.
   유사 사례가 없으면 억지로 답하지 않고 에스컬레이션을 권고합니다.
3. **대응 체크리스트 · 실시간 조치 확인** — 장애별 체크리스트를 개조식으로
   보여주고, 각 항목을 체크할 때마다 조치 상태를 기록합니다.
4. **테스트 검증 · 시스템 복구** — 체크리스트 완료 후 테스트 데이터로 정상
   작동 여부를 확인하고, 샌드박스 MTS 주문 데이터를 장애 발생 이전 상태로
   복구합니다 (스냅샷 기반 롤백 시뮬레이션).
5. **LLM 요약 (선택)** — `ANTHROPIC_API_KEY`가 설정되어 있으면 Claude가
   구조화된 분석 결과를 자연어 요약으로 다듬어줍니다.

## 기술 스택

Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres + Realtime)
· Claude API (`@anthropic-ai/sdk`) · Vercel (배포 + Cron)

## 빠른 시작

```bash
npm install
cp .env.example .env.local   # Supabase/Anthropic 키 채우기
npm run dev
```

자세한 내용은 [docs/SETUP.md](docs/SETUP.md) 참고.

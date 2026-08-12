# 설정 및 배포 가이드

## 1. Supabase 프로젝트 준비

1. [supabase.com](https://supabase.com) 에서 새 프로젝트를 만듭니다.
2. 프로젝트 대시보드 → **SQL Editor** 에서 `supabase/migrations/0001_init.sql`
   내용을 붙여넣고 실행합니다. (테이블 생성 + RLS 설정 + 지식베이스/모의
   원장 데이터 시드까지 한 번에 처리됩니다.)
3. **Project Settings → API** 에서 아래 세 값을 확인합니다.
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (절대 클라이언트에
     노출하거나 커밋하지 마세요)
4. **Database → Replication** 에서 `supabase_realtime` publication에
   `system_logs`, `incident_events`, `checklist_progress`, `mts_orders`가
   포함되어 있는지 확인합니다 (마이그레이션이 자동으로 추가하지만, UI에서
   재확인하는 것을 권장합니다).

## 2. 로컬 실행

```bash
npm install
cp .env.example .env.local
# .env.local 에 위 세 값 + (선택) ANTHROPIC_API_KEY 입력
npm run dev
```

http://localhost:3000 에서 대시보드가 뜨면, "지금 로그 1건 생성" 버튼으로
바로 테스트할 수 있습니다.

> **참고**: 이 프로젝트는 OneDrive처럼 실시간 동기화되는 폴더 밖에서
> 개발하는 것을 권장합니다. `node_modules` 설치 중 동기화 충돌로 설치가
> 실패하는 사례가 있었습니다 (`docs/DECISIONS.md` 5번 참고).

## 3. Claude API (선택)

`ANTHROPIC_API_KEY`를 설정하면 장애 요약이 자연어로 다듬어집니다.
[console.anthropic.com](https://console.anthropic.com)에서 발급받은 키를
`.env.local`과 Vercel 프로젝트 환경변수에 추가하세요. 키가 없어도 나머지
기능(로그 감지, 유사 사례 매칭, 체크리스트, 복구 시뮬레이션)은 그대로
동작합니다.

## 4. GitHub

```bash
git init
git add .
git commit -m "Initial commit: Incident Response Copilot"
git branch -M main
git remote add origin https://github.com/<your-username>/incident_agent.git
git push -u origin main
```

## 5. Vercel 배포

1. [vercel.com/new](https://vercel.com/new) 에서 위 GitHub 레포를 Import.
2. **Environment Variables** 에 `.env.example`의 5개 값을 모두 등록합니다.
   (`CRON_SECRET`은 임의의 랜덤 문자열이면 됩니다. 설정하면 Vercel이 cron
   요청에 자동으로 `Authorization: Bearer <CRON_SECRET>` 헤더를 붙입니다.)
3. Deploy.
4. **Vercel Hobby(무료) 플랜 참고**: cron 작업의 최소 실행 간격에 제한이
   있을 수 있습니다. `vercel.json`은 6시간 간격(`0 */6 * * *`)으로
   설정해두었지만, 플랜 정책에 따라 실제 실행 빈도가 다를 수 있습니다.
   실행 빈도와 무관하게 대시보드의 "지금 로그 생성" 버튼과 "자동
   시뮬레이션(4초 간격)" 토글은 언제나 즉시 동작하므로, 발표·데모는 이
   버튼들로 진행하는 것을 권장합니다.

## 6. 배포 후 확인 체크리스트

- [ ] 대시보드 접속 시 지식베이스 8건, 모의 계좌/주문이 보이는지
- [ ] "지금 로그 1건 생성" 클릭 시 로그 스트림에 실시간으로 항목이 추가되는지
- [ ] ERROR 로그 발생 시 "감지된 장애" 목록에 새 항목이 뜨는지
- [ ] 장애 상세 페이지에서 체크리스트 체크 → 테스트 검증 → 시스템 복구까지
      순서대로 눌러 상태가 `resolved`로 바뀌는지
- [ ] `/knowledge-base` 에서 8개 사례가 모두 보이는지

# routinity-web 스펙

routinity-ios(RoutinityApp), routinity-backend 세션과의 교차 확인을 거쳐 정리한 웹 클라이언트 스펙입니다. 작성일 2026-08-20.

## 1. 배경 및 배포

- **왜 웹인가**: 해커톤 제출 요건에 "배포 완료 프로덕트 URL(필수, 행사 종료까지 유지)"이 있는데, iOS는 TestFlight 배포에 Apple Developer Program 유료 가입($99)이 필요해 대안이자 메인 제출물로 웹 버전을 제작. iOS/웹 둘 다 유지하되 웹을 메인 제출 URL로 사용.
- **repo**: https://github.com/MeoHyeok/routinity-web (public)
- **배포**: https://meohyeok.github.io/routinity-web/ — `main` 브랜치 푸시 시 `.github/workflows/deploy.yml`(GitHub Actions)이 자동 빌드 후 GitHub Pages로 배포. 별도 서버 불필요, 브라우저에서 Supabase Edge Functions를 직접 호출.
- **스택**: React + Vite + TypeScript, Tailwind CSS(v4, `@theme` 토큰), `react-router-dom`(`HashRouter` — GitHub Pages 정적 호스팅 특성상 경로 새로고침 대응), `@supabase/supabase-js`.

## 2. 백엔드 연동 원칙

- **routinity-backend를 그대로, 수정 없이 사용한다.** iOS(RoutinityApp)가 이미 라이브로 쓰고 있는 스키마/엔드포인트를 웹이 그대로 소비. Functions base: `https://noqvrfewkyfdrsoaszmz.supabase.co/functions/v1`.
- **⚠️ 중요 정책**: 웹 쪽 요구사항 때문에 이 백엔드의 기존 스키마/엔드포인트를 고쳐야 하는 상황이 생기면, 기존 것을 수정하지 말고 **웹 전용 백엔드를 별도로 새로 만든다.** iOS가 실사용 중인 백엔드 계약을 깨뜨리지 않는 것이 최우선.
- 인증: Supabase Auth 이메일/비밀번호만 지원(소셜 로그인 없음). 세션/refresh는 커스텀 엔드포인트 없이 `supabase-js` 표준 방식 그대로.

## 3. 화면 구성

`src/App.tsx` 기준, iOS 화면을 1:1 포팅.

| 라우트 | 컴포넌트 | 설명 |
|---|---|---|
| (비로그인) | `AuthPage` | 로그인/회원가입 탭 전환, 이메일 인증 필요 시 안내 |
| `/` | `TodayPage` | 원탭 기록(기상→취침, 식사, 공부), 오늘 점수 링, 연속 달성일, 전날 대비 델타, 세션 캐리오버 배너 |
| `/analysis` | `AnalysisPage` | 주간/월간 평균, 추이 차트(SVG polyline), 루틴 로스 분석(기상지연/공부지연/식사불규칙), 요일별 베스트/워스트 |
| `/ai-coach` | `AICoachPage` | 일간/주간/월간 AI 리포트, 24시간 시간분배 도넛차트, 목표 제안 카드 |
| `/goals` | `GoalsPage` | 기상 목표(time picker), 공부 시간 목표(분), 목표 제안값 적용, 삭제 |
| `/timeline` | `TimelinePage` | 날짜별 원시 로그 목록, 개별 삭제 |
| `/settings` | `SettingsPage` | 타임라인/목표 링크, 로그아웃 |

하단 탭바(오늘/분석/AI 코치)는 `TabLayout`으로 고정, 목표/타임라인/설정은 스택 네비게이션(뒤로가기 `←`) 형태.

## 4. API 계약 (routinity-backend 세션 확인)

전체 원문: [routinity-backend/docs/api-contract.md](https://github.com/MeoHyeok/routinity-backend/blob/main/docs/api-contract.md)

### 엔드포인트

- `POST /logs` — body `{ type, timestamp(ISO8601) }` → 201 `{ id, type, timestamp, created_at }`
- `GET /logs?date=YYYY-MM-DD` — 200, 로그 배열(시간순), 없으면 `[]`
- `DELETE /logs?id=<uuid>` — 204 / 404 `{error:"log not found"}`
- `POST /goals`(upsert) — body `{ target_type, target_value }` → 200 `{id, target_type, target_value, updated_at}`. `wake_time`은 `"HH:MM"`(24h), `study_duration`은 1 이상 정수 문자열(분)
- `GET /goals` — `[{id, target_type, target_value, updated_at}]`, target_type 오름차순
- `DELETE /goals?target_type=<string>` — 204 / 404
- `GET /scores?date=YYYY-MM-DD` — `{date, daily_score(0-100|null), scores:[{target_type, target_value, actual_value(nullable), status}]}`
- `GET /reports-daily` — `{period:"daily", date, content, time_breakdown, suggested_action, cached, generated_via?}`
- `GET /reports-weekly` — `{period:"weekly", content, time_breakdown, suggested_action, cached, generated_via?}` (date 없음)
- `GET /reports-monthly` — `{period:"monthly", date_range:{from,to}, content, time_breakdown, suggested_action, cached, generated_via?}`
- `GET /insights` — `{date_range, weekday_averages:[{weekday,label,avg_daily_score,days_counted}], best_weekday, worst_weekday, trend}`

`generated_via`는 `cached:false`(방금 생성)일 때만 존재 — **캐시 응답엔 이 필드가 없음**, 웹 코드에서 옵셔널 체이닝 필요.

### 에러

공통 바디 `{"error": "..."}` (401만 플랫폼 레벨이라 `{code, message}`일 수 있음).

| 코드 | 의미 |
|---|---|
| 400 | 파라미터 누락/형식 오류 (필드별 구체 메시지) |
| 401 | Authorization 헤더 없음/무효 |
| 404 | DELETE 대상 없음(소유권 무관 동일 404로 존재 비노출) |
| 405 | 미지원 메서드 |
| 429 | `rate limit exceeded, try again later` |
| 500 | `internal server error` |

### rate limit (유저·엔드포인트별, 1분 고정 윈도우)

`/logs` 60/분 · `/goals` 20/분 · `/scores` 60/분 · `/insights` 20/분 · `/reports-*` 각 10/분(어차피 하루 1회만 실제 생성, 나머진 캐시).

## 5. 핵심 도메인 로직

### "하루"의 정의 (`_shared/day-sessions.ts`, `src/lib/todayLogs.ts`, `routineDayMetrics.ts`)

고정 자정 경계가 아니라 **유저의 "기상 로그 → 다음 취침 로그"를 하나의 세션**으로 묶어 "하루"로 취급.

- 세션은 자정을 넘겨도 갈라지지 않음. 세션 날짜 라벨 = 세션을 연 wake 로그의 KST 캘린더 날짜.
- wake 로그가 없으면 그날 세션 자체가 없음 → 관련 값 전부 missing.
- 세션이 24시간 넘게 열려 있으면: 새 wake가 오면 새 세션 시작(이전 건 미종료 마감), 새 wake 없이 시간만 흐르면 내부적으로 자동 종료(응답엔 비노출, `time_breakdown`은 계속 null).
- 세션 열린 중 중복 wake(낮잠 등)는 같은 세션에 흡수, 가장 이른 wake가 채점 기준.
- `/reports-daily`는 "자정 막 넘겼는데 어제 세션이 방금 취침으로 닫혔으면 그 세션을 오늘 리포트로 채택"하는 예외 처리가 있음(`date`가 어제 날짜로 나갈 수 있음).
- 웹의 `fetchTodayLogsWithCarryover`(TodayPage)는 오늘 fetch에 wake가 없으면 어제 세션이 아직 열려 있는지 확인해 그걸 "오늘"로 보여주는 캐리오버 배너를 표시 — iOS `LogsViewModel.loadTodayIncludingCarryover`와 동일 동작.

### 점수 계산

- `status`: `achieved` / `not_achieved` / `missing`.
- 채점 규칙이 있는 target_type은 `wake_time`, `study_duration` 둘뿐(그 외 타입은 자유 저장 가능하지만 `/scores`에서 조용히 제외 — 현재 확장 계획 없음).
- `daily_score`(0-100 정수 | null): 목표별 credit(achieved=1, missing=0, study_duration not_achieved=실제/목표 비율, wake_time not_achieved=늦은 정도 비례 감소·120분 이상 늦으면 0)의 평균×100. 채점 가능 목표 0개면 null.
- 조회 date가 목표 생성일보다 과거면 그 목표는 채점 제외.

### AI 리포트

- Claude 호출 조건: `ANTHROPIC_API_KEY` 존재 + 응답 정상(200/non-refusal/non-empty) — 아니면 룰 기반 템플릿 폴백. 모델 `claude-haiku-4-5-20251001`.
- 캐싱: user+period당 KST 하루 1회, DB unique index로 강제. 같은 날 재조회는 `cached:true`로 기존 content 그대로.
- `content`는 **plain text**(마크다운 아님) — 웹에서 `white-space:pre-wrap`으로만 렌더, 마크다운 파서 불필요.

### insights trend

28일 롤링 윈도우. 최근 7일(오늘 포함) 평균 vs 그 이전 7일 평균 비교, 둘 다 데이터 있어야 계산(하나라도 없으면 `trend:null`). 차이 절댓값 3점 이하면 `flat`.

### 웹 자체 파생 로직 (`src/lib/`, iOS `RoutineDayMetrics.swift`/`GoalSuggestion.swift`/`TrendViewModel.swift` 포팅)

- `routineDayMetrics.ts`: 로그 배열 → 진행 중 세션(open since), 식사/공부 누적 분, 기상 후 휴식 경과분 등 순수 계산.
- `goalSuggestion.ts`: 최근 구간 미스율(`missRate`) ≥ 30%일 때 기상/공부 중 더 나쁜 쪽을 골라 "최근 평균 실제값"을 목표로 제안(표본 3개 미만이면 제안 안 함). `computeStreakDays`는 최신일부터 역순으로 daily_score ≥ 80인 연속 일수. `computePersonalAverageScore`는 마지막 날 제외한 이전 일들의 평균(오늘 대비 델타 계산용).
- `trend.ts`: N일치 `/scores`+`/logs`를 날짜별로 병렬 호출하되 `MAX_CONCURRENT_DAYS=10`으로 배치 — 30일 월간 윈도우가 60/분 rate limit을 자체적으로 넘지 않도록(iOS에서도 같은 버그를 이미 수정한 이력 있음, 웹도 동일 대응).

**주의**: 이 4개 파일은 iOS 로직과 동작이 갈리지 않도록 유지하는 기준 파일. 새 로직을 추가할 때는 iOS 쪽 대응 파일과 맞춰야 함.

## 6. 디자인 시스템

`src/index.css` — iOS `RoutinityApp/Views/Theme.swift`와 동일 팔레트, 다크 전용(라이트 모드 없음), glow가 있는 대시보드 톤.

```
--color-routinity-bg:     #0b0b11
--color-routinity-card:   #16161f
--color-routinity-border: rgba(255,255,255,0.06)
--color-routinity-violet: #8c5cf5
--color-routinity-pink:   #ed619e
--color-routinity-cyan:   #4dc7ed
--color-routinity-orange: #fa944a
--color-routinity-green:  #59d18c
```

`#root`는 `max-width:480px` 중앙 정렬(모바일 폭 고정, 데스크톱에서도 폰 레이아웃 유지). 아이콘은 이모지 기반(별도 아이콘 폰트/SVG 세트 없음, `public/icons.svg`는 파비콘류).

## 7. 알려진 제약 / iOS와의 차이

- **브라우저 알림 미지원** — iOS는 기상·취침 기록을 깜빡했을 때 하루 한 번 알림을 주지만, 웹은 이 기능이 없음(SettingsPage에 안내 문구로 명시).
- 위젯, 온보딩 전용 플로우 등 iOS 전용 기능은 웹에 없음(현재까지 확인된 범위에서는 알림 외 큰 기능 차이는 보고되지 않음 — 필요 시 iOS 세션에 추가 확인).
- 소셜 로그인 없음(이메일/비밀번호만).

## 8. 최근 수정 이력 (커밋 `da6f6ab`)

1. `QuickLogButton` 아이콘이 세션 상태와 무관하게 고정 표시되던 버그(기상/취침 전환해도 항상 🌙로 보임) 수정.
2. `TodayPage`/`AnalysisPage`/`AICoachPage`의 데이터 로딩 `useEffect`들이 겹치는 요청에 가드가 없어, 느린 이전 요청이 새 요청보다 늦게 끝나면 정상 데이터 위에 에러가 겹쳐 뜨던 레이스 컨디션 — 각 요청에 최신성 체크 추가.

## 9. 테스트 계정

이메일 인증이 완료 처리된 테스트 계정(`routinity-web-test-*@gmail.com`)이 있음 — 이 저장소가 public이라 자격증명은 이 문서에 남기지 않음, 필요하면 팀 채널/세션 간 메시지로 별도 공유. 반복 테스트로 계정이 일시적으로 429(rate limit) 상태일 수 있으니 시간을 두고 사용 권장.

# 루티니티 (routinity-web)

루티니티의 웹 버전 — React + Vite + TypeScript. iOS 클라이언트([routinity-ios](https://github.com/MeoHyeok/routinity-ios))와 완전히 같은 Supabase 백엔드([routinity-backend](https://github.com/MeoHyeok/routinity-backend))를 그대로 사용합니다.

## 화면

- **로그인/가입**: Supabase Auth (이메일/비밀번호)
- **오늘**: 원탭 기록(기상/식사/공부/취침), 오늘의 루틴 점수, 연속 달성일
- **분석**: 주간/월간 루틴 점수 추이, 로스 분석, 요일별 베스트/워스트
- **AI 코치**: 일간/주간/월간 AI 리포트, 목표 제안
- **목표 설정 / 타임라인**: 설정(⚙️)에서 진입

## 개발

```bash
npm install
npm run dev
```

## 배포

`main` 브랜치 푸시 시 GitHub Actions가 자동으로 빌드해서 GitHub Pages로 배포합니다 (`.github/workflows/deploy.yml`). 별도 서버/백엔드 배포는 필요 없습니다 — Supabase Edge Functions를 직접 호출합니다.

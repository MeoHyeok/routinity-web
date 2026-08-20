# 로컬 개발 셋업

## 요구 사항

- Node.js `^20.19.0` 또는 `>=22.12.0` (Vite 8 요구사항)

## 절차

```bash
git clone https://github.com/MeoHyeok/routinity-web.git
cd routinity-web
npm install
npm run dev
```

그러면 **`http://localhost:5173/routinity-web/`** 에서 뜹니다. `vite.config.ts`의 `base`가 `/routinity-web/`로 설정돼 있어서 이 경로까지 들어가야 하며, `/`로만 접속하면 빈 화면일 수 있습니다 — 막히기 가장 쉬운 포인트입니다.

## 환경변수

**없습니다.** Supabase 프로젝트 URL과 anon key가 `src/lib/supabase.ts`에 하드코딩되어 있습니다. anon key는 원래 공개되어도 되는 키이고(실제 데이터 보호는 백엔드의 Row Level Security가 담당), iOS 클라이언트가 `Secrets.plist`에 담아 배포하는 것과 동일한 방식입니다. `.env` 파일을 따로 만들 필요 없이 `npm install` 후 바로 `npm run dev`면 됩니다.

## 로그인

팀원 본인 이메일로 회원가입하거나, 공유 테스트 계정(`routinity-web-test-...`)을 쓰면 됩니다. 다만 공유 계정은 여러 사람이 동시에 테스트할 때 레이트리밋(429)에 걸릴 수 있으니, 새로 가입하는 쪽을 추천합니다.

## 빌드 / 린트 확인

PR을 올리기 전에 아래 두 명령이 깨끗하게 통과하는지 확인해주세요.

```bash
npm run build   # tsc -b && vite build
npm run lint     # oxlint
```

## 배포

`main` 브랜치에 푸시하면 GitHub Actions(`.github/workflows/deploy.yml`)가 자동으로 빌드해서 GitHub Pages(`https://meohyeok.github.io/routinity-web/`)로 배포합니다. 별도의 수동 배포 절차는 없습니다.

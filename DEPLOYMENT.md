# 운영 배포

현재 운영은 Google Cloud Run입니다. 아래 Cloudflare 안내는 이전 배포 대안이며 실제 운영 설정이 아닙니다.

- GCP 프로젝트: `ksool-web-game`
- 리전: `us-central1`
- 커뮤니티 서비스: `ksool-community`
- 커뮤니티 주소: https://ksool.minibig.pw/
- 게임 주소: https://play.ksool.minibig.pw/ (별도 서비스, 이 저장소로 배포하지 않음)

```sh
npm test
npm run build
gcloud run deploy ksool-community --source . --project ksool-web-game --region us-central1 --set-env-vars "ADMIN_EMAILS=jhm9595@gmail.com" --allow-unauthenticated --quiet
```

`main` 브랜치에 푸시하면 GitHub Actions([deploy.yml](.github/workflows/deploy.yml))가 `npm test` 실행 후 Workload Identity Federation으로 Cloud Run(`ksool-community`)에 자동 배포합니다. `.gcloudignore`는 로컬 DB·환경 파일·Git 정보를 업로드에서 제외합니다.

현재 Dockerfile의 SQLite 위치는 `/tmp`이며 Cloud Run 인스턴스 로컬 임시 저장소입니다. 재배포·재시작·다중 인스턴스 간 게시글 영속성을 보장하지 않습니다. 이번 변경은 저장소를 이전하지 않습니다. 장기 운영에는 외부 영구 DB로 이전이 필요합니다.

## 이전 Cloudflare 배포 대안

# 배포와 비용

검증 기준: 2026-11-01. Cloudflare Workers + D1 Free 플랜을 기본으로 사용합니다. 유료 플랜으로 전환하거나 결제 수단을 등록하는 작업은 하지 않았습니다.

## 무료 범위

- 정적 자산 요청: 무료·무제한
- Workers API: 하루 100,000 요청, 요청당 CPU 10ms
- D1: 하루 5,000,000행 읽기 / 100,000행 쓰기 / 계정 합계 5GB 저장
- 한도는 방문자 수가 아닌 요청과 DB 작업량 기준입니다. 인덱스·세션·투표·속도 제한 기록도 사용량에 포함됩니다.
- Free 플랜은 한도 초과 시 해당 작업이 제한될 수 있습니다. 유료로 자동 전환하는 로직은 없습니다.
- 유료가 필요해질 때 Workers Paid는 월 기본 $5 + 포함량 초과 사용량입니다. 월 $5가 최대 요금이라는 의미가 아닙니다.
- 커스텀 도메인 구입 비용은 별도입니다. 기본 workers.dev 주소로 시작할 수 있습니다.

출처:
- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/

## 배포 준비

Cloudflare 계정으로 로그인하고 D1을 생성해야 합니다. 아래 단계는 아직 실행하지 않았습니다.

```sh
npx wrangler login
npx wrangler d1 create ksool-community
```

반환된 database_id를 `wrangler.jsonc`에 입력하세요. 기본값 `00000000-0000-0000-0000-000000000000`은 자리표시자입니다. 다른 프로젝트의 DB를 사용하지 않습니다.

```sh
npx wrangler d1 migrations apply ksool-community --remote
npm run build
npx wrangler deploy
```

`index.html`, `app.js`의 게임 링크와 우측 게임 패널은 실제 게임 주소 `https://jhm9595.github.io/KSool_Gemini/`로 설정되어 있습니다. 게임 연동을 시작할 때만 정확한 게임 출처를 `GAME_ORIGINS`에 넣으세요.

## 운영 데이터

- 배포에는 `.data`, 로컬 DB, 테스트, 서버 소스 파일이 정적 자산으로 포함되지 않습니다. `scripts/build.mjs`가 명시된 공개 파일만 dist에 복사합니다.
- 로컬 예시 글/투표는 배포 DB에 자동 이관되지 않습니다. 실제 서비스는 빈 커뮤니티 DB로 시작합니다.
- 신고는 reports 테이블에 쌓입니다. 현재 별도 관리자 화면은 없습니다. Cloudflare D1 콘솔에서 확인 후 운영자가 글을 소프트 삭제할 수 있습니다.
- 반복 요청은 IP의 SHA-256 식별값으로 제한합니다. 원본 IP를 DB에 저장하지 않습니다. 익명 세션으로 모든 자동화·다중 기기 투표를 막을 수는 없습니다.
- 시간당 Cron이 오래된 rate_limits 레코드를 정리합니다. 로컬 서버도 정리합니다.
- 공개 전 운영 규모에 맞게 계정 로그인/신고 처리 체계와 이용약관을 정하면 됩니다.

## 백업

Cloudflare D1의 내보내기로 백업할 수 있습니다:

```sh
npx wrangler d1 export ksool-community --remote --output community-backup.sql
```

이 파일은 사용자 게시글을 포함하므로 공개 dist에 넣지 마세요. 로컬 DB는 서버를 정지한 뒤 `.data/community.sqlite`를 별도로 보관합니다.

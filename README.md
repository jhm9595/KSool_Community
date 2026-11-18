# 조합소 — 독립 공략·커뮤니티 사이트

위치: `C:/secjob/KSool_Community_Draft`. 원본 게임 소스는 수정하지 않습니다.

## 로컬 실행

Node.js 24 이상:

```sh
npm ci
npm run build
npm start
```

http://localhost:8766/ 에서 확인합니다. `#community`는 정보 공유 게시판, `#recommendations`는 게임 형식의 조합 추천 목록입니다.

- 로컬 서버: 내장 SQLite, `.data/community.sqlite`에 영구 저장
- 배포 대상: Cloudflare Workers + D1. 별도 유료 서버 계약 없음
- 로컬 미리보기는 본인 컴퓨터에서만 접근됩니다. 공개 서비스는 아래 배포 절차가 필요합니다.

## 구현

- 네오 브루탈리즘, 짧은 문구와 아이콘, 전체 폭 반응형 조합 보드
- 공식 조합 84개, 재료/비율 바로 표시, 검색·필터·정렬
- 오른쪽 모바일 게임 패널: 실제 GitHub Pages 게임을 iframe으로 표시, 넓은 화면은 기본 열림, 작은 화면은 상단 버튼으로 전환. 패널을 접어도 iframe을 제거하지 않아 플레이 상태를 유지합니다. 게임 데이터 자동 동기화 기능과는 별개입니다.
- 커뮤니티 글, 새 조합, 댓글, 공유 링크, 신고, 내 글 삭제(소프트 삭제)
- 서버의 좋아요/싫어요, 동일 조합 간 카운터 공유, 중복 투표 방지와 방향 전환
- 게임의 `suggestion_key/items/upvotes/downvotes/is_applied` 형식과 동일한 API
- 브라우저에만 저장되는 것은 개인 북마크입니다. 글·댓글·추천은 공용 DB에 저장됩니다.
- 안내 글 3개는 '예시'로 표시합니다. 로컬 미리보기의 '초안 예시' 글은 작성·댓글·투표 검증용입니다.

## 게임 데이터 갱신

게임 소스를 읽기만 하고 외부 사이트 사본을 갱신합니다:

```sh
node scripts/sync-game-data.mjs
npm run build
```

`server/catalog.mjs` 변경을 반영하려면 실행 중인 로컬 서버도 재시작합니다. 최신 변경 비교는 [SYNC_REPORT.md](SYNC_REPORT.md)를 참고하세요.

## 검증

```sh
npm test
npx wrangler deploy --dry-run --outdir .worker-build
```

서로 다른 익명 세션의 공유 데이터, 중복/전환 투표, 같은 조합의 공용 카운터, 댓글, 작성자 권한, 게임 어댑터, 재시작 후 DB 유지, 요청 출처/입력 검증을 테스트합니다.

## 게임과 연동

[게임 API 계약](integration/README.md)을 참고하세요. 최근 게임 소스에는 Supabase 추천 저장·조회 코드도 있습니다. 현재 외부 사이트의 공용 DB는 별도의 SQLite/D1이므로 이 Supabase 저장소와 자동으로 동기화되지는 않습니다. 서버 API와 미래 연결용 `GameSuggestionClient.mjs`만 외부 프로젝트에 제공합니다. 연결 전부터 자동 동기화된다고 표시하지 않습니다.

## 배포 및 비용

[배포·비용 안내](DEPLOYMENT.md). 지금은 로컬 실행과 배포 빌드만 검증했고, Cloudflare 계정에 배포하지 않았습니다. `wrangler.jsonc`의 0으로 된 DB ID는 실제 생성한 ID로 교체해야 합니다. 게임 이동 및 우측 모바일 패널은 https://jhm9595.github.io/KSool_Gemini/ 를 사용합니다.

2026-11-17 점검: 원격 저장소 연결을 복구하고 커뮤니티 게시판, 전체 목록 표시, 진행도 정규화 및 클라우드 주기 갱신을 수정했습니다. 게스트 게임창의 즉시 반영에는 실제 게임 배포 소스에 `integration/game-progress-bridge.js` 설치가 필요합니다. 자세한 내용은 integration/README.md를 확인하세요.

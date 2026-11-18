# 게임 추천 탭 API 계약

게임 소스에서 확인한 데이터 구조를 그대로 사용합니다. 게임 내부 파일은 변경하지 않았습니다.

```json
{
  "suggestions": [{
    "suggestion_key": "101:0@2+102:0@1",
    "items": [
      {"ingredient_id":101,"detail_id":null,"ratio":2},
      {"ingredient_id":102,"detail_id":null,"ratio":1}
    ],
    "upvotes":1,
    "downvotes":0,
    "is_applied":false
  }],
  "userVotes":{"101:0@2+102:0@1":"UP"},
  "nextBefore":null
}
```

`ingredient_id`, `detail_id`, `ratio`를 유지합니다. 키는 게임의 `_buildKey`와 동일하게 `${baseId}:${detailId || 0}@${count}` 문자열을 기본 문자열 정렬한 후 `+`로 연결합니다. 재료 순서만 다른 제안은 한 조합으로 합쳐집니다. 1:1과 2:2는 게임 키 규칙에 따라 별개입니다.

## API

| 메서드 | 경로 | 역할 |
|---|---|---|
| GET | `/api/session` | 익명 HttpOnly 세션 쿠키 |
| GET | `/api/suggestions` | 게임 형식의 조합·추천 수·현재 세션 투표 |
| GET | `/api/suggestions?available=101,102` | 해금 재료로만 만든 추천 필터 |
| POST | `/api/suggestions` | `{items}` 또는 `{potSlots:[{baseId,detailId,count}]}`로 제안. 게임처럼 본인 UP 1개 반영 |
| PUT | `/api/votes` | `{suggestion_key,type:"UP"|"DOWN"}` |
| PUT | `/api/votes` | `{post_id,type:"UP"|"DOWN"}`: 조합 글이면 같은 suggestion_key에 투표 |
| GET, POST | `/api/posts` | 커뮤니티 조회·글쓰기 |
| GET, DELETE | `/api/posts/:id` | 글 조회·작성자만 소프트 삭제 |
| GET, POST | `/api/posts/:id/comments` | 댓글 조회·작성 |
| POST | `/api/reports` | `{post_id,reason}` 신고 접수 |

모든 쓰기 요청은 JSON입니다. `GET /api/suggestions`의 `nextBefore`가 있으면 `?before=`로 이어서 읽습니다. 게시판도 같은 방식으로 페이지를 조회합니다. 프런트엔드는 페이지를 이어 읽어 '더 보기' 클릭 없이 표시합니다.

## 일관성

- 같은 조합의 게시글이 여러 개여도 공용 `suggestion_key`의 투표를 참조합니다.
- `(target_key, actor_id)` 유일 키로 중복 UP/DOWN을 방지합니다.
- UP→DOWN 전환은 단일 UPSERT이고, 추천 수는 실제 vote 레코드에서 집계합니다.
- 클라이언트가 전달한 `upvotes`, `downvotes`, `is_applied`는 신뢰하지 않습니다.
- 예전 게임의 로컬 예시 추천 수를 실제 사용자 투표로 가져오지 않습니다.
- 일반 팁은 글 ID별로 투표합니다.
- 작성한 글을 지워도 조합 자체와 해당 조합의 공용 투표 기록은 유지됩니다.
- 익명 세션 기준입니다. 쿠키 삭제·다른 기기까지 동일인으로 묶는 계정 로그인은 구현하지 않았습니다.

## 연결 어댑터

`GameSuggestionClient.mjs`는 외부 프로젝트 안에만 존재합니다. 기존 게임의 서비스와 달리 서버 통신에는 `await`가 필요하므로 무변경 교체용이라고 주장하지 않습니다.

```js
import {GameSuggestionClient} from './GameSuggestionClient.mjs';
const client = new GameSuggestionClient('https://community.example.com', {inventory});
await client.init();
client.getActiveSuggestions();
await client.submitFromPot(potSlots);
await client.vote(suggestionKey, 'UP');
const snapshot = client.exportGameSnapshot();
```

2026-11-02 소스에는 Supabase의 ksool_suggestions 테이블에 추천을 저장·조회하는 코드가 추가되어 있습니다. 외부 사이트의 SQLite/D1과는 다른 저장소입니다. 이 어댑터는 외부 API 형식 호환용이며, 게임의 Supabase DB와 자동 동기화하는 기능은 아직 없습니다. 실제 연결은 기존 Supabase 저장소를 공통으로 사용할지 또는 서버 간 동기화를 둘지 정한 뒤 별도로 구현해야 합니다.

출처는 `wrangler.jsonc`의 `GAME_ORIGINS`에 정확히 지정합니다. 다른 출처에서 요청할 때 `credentials: 'include'`가 필요합니다. `game.example.com` / `community.example.com`처럼 같은 사이트의 하위 도메인을 권장합니다. 서로 다른 사이트 간 익명 쿠키 공유는 브라우저의 제3자 쿠키 제한으로 보장되지 않으므로 실제 운영 도메인과 인증 방식을 연결 시 확정해야 합니다.

`is_applied`는 기존 게임 스키마와 호환되지만 관리자 도감 편입은 현재 외부 API에 노출하지 않습니다.

## 2026-11-17 진행도 연동 명세

게임 개발자 전달은 [GAME_DEVELOPER_HANDOFF.md](GAME_DEVELOPER_HANDOFF.md)를 기준으로 합니다. 이 문서가 이전 1초 저장소 폴링 초안을 대체합니다. `game-progress-bridge.js`는 REQUEST/PROGRESS/ACK v1 송신 참고 코드이며, 게임 개발자가 초기화와 변경 완료 지점에서 publish를 호출해야 합니다. 커뮤니티에는 수신 로직만 설치했습니다. 운영 배포 및 실제 게임 연결 검증은 미완료입니다.

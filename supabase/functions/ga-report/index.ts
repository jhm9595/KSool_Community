import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GA4_PROPERTY_ID = "564332931";
const GA4_BASE = `https://analyticsdata.googleapis.com/v1beta/properties/${GA4_PROPERTY_ID}`;
const DEFAULT_ADMIN_EMAILS = ["jhm9595@gmail.com"];

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GAME_MODE_LABELS: Record<string, string> = {
  quiz: "🔬 술 조합 퀴즈(연구실)",
  tycoon: "🏪 주점 타이쿤 (일반 영업)",
  tycoon_infinite: "🔥 주점 타이쿤 (무한 모드)",
  sos: "🆘 친구 SOS 대신 풀어주기",
  scratch: "🎟️ 설명 힌트 복권 긁기",
  fridge: "🧊 내 냉장고 맞춤 추천",
  party_updown: "🍻 [술게임] 병뚜껑 업앤다운",
  party_capflick: "🍻 [술게임] 병뚜껑 꼬다리 치기",
  party_surface: "🍻 [술게임] 표면장력 한잔",
  party_bottlespin: "🍻 [술게임] 운명의 소주병 돌리기",
  party_hunmin: "🍻 [술게임] 훈민정음 폭탄",
  party_baskin: "🍻 [술게임] 배불러라빈스 31",
  party_penaltycocktail: "🍻 [술게임] 랜덤 벌칙주 제조기",
  party_fridge: "🍻 [술게임] 냉장고를 부탁해",
  party_market: "🍻 [술게임] 시장에 가면",
  party_iamground: "🍻 [술게임] 아이엠그라운드",
};

const LEVEL_ID_LABELS: Record<string, string> = {
  step_1: "1단계 (입문·편의점 꿀조합)",
  step_2: "2단계 (대학가·술자리 단골)",
  step_3: "3단계 (막걸리·과일 변주)",
  step_4: "4단계 (회식·폭탄주 심화)",
  step_5: "5단계 (팔도 전통주·특산주)",
  step_6: "6단계 (장인의 비급 명주)",
  stage_1: "주점 1호점 (포장마차)",
  stage_2: "주점 2호점 (대학가 주막)",
  stage_3: "주점 3호점 (을지로 골목)",
  stage_4: "주점 4호점 (홍대 라운지)",
  stage_5: "주점 5호점 (강남 다이닝바)",
  stage_6: "주점 6호점 (네온 루프탑)",
  tabletop: "술자리 단판",
};

const AD_TYPE_LABELS: Record<string, string> = {
  scratch_desc: "설명 힌트 복권 광고",
  scratch_image: "SOS 그림 힌트 광고",
  baseball_hint: "숫자야구 힌트 광고",
  revive: "타이쿤 부활 광고",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json; charset=utf-8" },
  });
}

function formatDuration(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return m > 0 ? `${m}분 ${rem}초` : `${rem}초`;
}

function pct(part: number, total: number): number {
  if (!total || total <= 0) return 0;
  return Math.round((part / total) * 1000) / 10;
}

function deltaPct(curr: number, prev: number): number {
  if (!prev || prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 1000) / 10;
}

function getHosts(hostScope: string): string[] {
  if (hostScope === "game") return ["play.ksool.minibig.pw"];
  if (hostScope === "site") return ["ksool.minibig.pw"];
  return ["play.ksool.minibig.pw", "ksool.minibig.pw"];
}

function getRangeDays(range: string): { currentStart: string; prevStart: string; prevEnd: string; days: number } {
  if (range === "7d") return { currentStart: "7daysAgo", prevStart: "14daysAgo", prevEnd: "8daysAgo", days: 7 };
  if (range === "90d") return { currentStart: "90daysAgo", prevStart: "180daysAgo", prevEnd: "91daysAgo", days: 90 };
  return { currentStart: "28daysAgo", prevStart: "56daysAgo", prevEnd: "29daysAgo", days: 28 };
}

function hostFilter(hosts: string[]) {
  return {
    filter: {
      fieldName: "hostName",
      inListFilter: { values: hosts, caseSensitive: false },
    },
  };
}

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const clean = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function getGoogleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64UrlEncode(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/analytics.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${header}.${claim}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(sa.private_key),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${base64UrlEncode(new Uint8Array(sig))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  const tokenJson = await tokenRes.json();
  if (!tokenRes.ok || !tokenJson.access_token) {
    throw new Error(`Google OAuth 실패: ${tokenJson.error_description || tokenJson.error || tokenRes.status}`);
  }
  return tokenJson.access_token;
}

async function gaFetch(accessToken: string, endpoint: "runReport" | "runRealtimeReport", body: unknown) {
  const res = await fetch(`${GA4_BASE}:${endpoint}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(`GA4 API 오류 (${res.status}): ${data?.error?.message || JSON.stringify(data)}`);
  }
  return data;
}

type GaRow = { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] };
const dim = (row: GaRow, idx: number) => row.dimensionValues?.[idx]?.value ?? "";
const met = (row: GaRow, idx: number) => Number(row.metricValues?.[idx]?.value ?? 0) || 0;

function formatSourceLabel(sourceMedium: string): string {
  const lower = sourceMedium.toLowerCase();
  if (lower.includes("blog") && lower.includes("post")) return "📝 공식 블로그 글 링크";
  if (lower === "google / organic") return "🔍 구글 검색";
  if (lower.includes("naver")) return "🟩 네이버 유입";
  if (lower === "(direct) / (none)") return "🔗 북마크 / 직접 입력 / 카톡 공유";
  if (lower.includes("ksool.minibig.pw")) return "🏠 커뮤니티 사이트에서 게임 이동";
  if (lower.includes("play.ksool.minibig.pw")) return "🎮 게임에서 커뮤니티 이동";
  return sourceMedium || "기타";
}

async function buildReport(accessToken: string, report: string, range: string, hostScope: string) {
  const hosts = getHosts(hostScope);
  const { currentStart, prevStart, prevEnd } = getRangeDays(range);

  if (report === "realtime") {
    const data = await gaFetch(accessToken, "runRealtimeReport", {
      dimensions: [{ name: "unifiedScreenName" }],
      metrics: [{ name: "activeUsers" }],
    });
    const rows: GaRow[] = data.rows || [];
    let activeUsersNow = 0;
    const topScreens = rows.map((r) => {
      const users = met(r, 0);
      activeUsersNow += users;
      return { title: dim(r, 0) || "(제목 없음)", users };
    });
    return { activeUsersNow, topScreens: topScreens.slice(0, 6) };
  }

  if (report === "overview") {
    const data = await gaFetch(accessToken, "runReport", {
      dateRanges: [
        { startDate: currentStart, endDate: "today", name: "current" },
        { startDate: prevStart, endDate: prevEnd, name: "previous" },
      ],
      dimensions: [{ name: "date" }, { name: "hostName" }, { name: "dateRange" }],
      metrics: [
        { name: "activeUsers" },
        { name: "newUsers" },
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "userEngagementDuration" },
      ],
      dimensionFilter: hostFilter(hosts),
      orderBys: [{ dimension: { dimensionName: "date" } }],
    });

    const rows: GaRow[] = data.rows || [];
    const totals = {
      current: { activeUsers: 0, newUsers: 0, engagement: 0, gameUsers: 0, siteUsers: 0 },
      previous: { activeUsers: 0, newUsers: 0, engagement: 0 },
    };
    const byDate = new Map<string, { date: string; gameUsers: number; siteUsers: number }>();

    for (const r of rows) {
      const rawDate = dim(r, 0);
      const host = dim(r, 1).toLowerCase();
      const rangeName = dim(r, 2) === "previous" ? "previous" : "current";
      const activeUsers = met(r, 0);
      const newUsers = met(r, 1);
      const engagement = met(r, 4);

      if (rangeName === "current") {
        totals.current.activeUsers += activeUsers;
        totals.current.newUsers += newUsers;
        totals.current.engagement += engagement;
        if (host.includes("play.")) totals.current.gameUsers += activeUsers;
        else totals.current.siteUsers += activeUsers;

        const isoDate = rawDate.length === 8 ? `${rawDate.slice(0, 4)}-${rawDate.slice(4, 6)}-${rawDate.slice(6, 8)}` : rawDate;
        const entry = byDate.get(isoDate) || { date: isoDate, gameUsers: 0, siteUsers: 0 };
        if (host.includes("play.")) entry.gameUsers += activeUsers;
        else entry.siteUsers += activeUsers;
        byDate.set(isoDate, entry);
      } else {
        totals.previous.activeUsers += activeUsers;
        totals.previous.newUsers += newUsers;
        totals.previous.engagement += engagement;
      }
    }

    const currRetPct = totals.current.activeUsers > 0
      ? Math.max(0, pct(totals.current.activeUsers - totals.current.newUsers, totals.current.activeUsers))
      : 0;
    const prevRetPct = totals.previous.activeUsers > 0
      ? Math.max(0, pct(totals.previous.activeUsers - totals.previous.newUsers, totals.previous.activeUsers))
      : 0;
    const currAvgSec = totals.current.activeUsers > 0 ? Math.round(totals.current.engagement / totals.current.activeUsers) : 0;
    const prevAvgSec = totals.previous.activeUsers > 0 ? Math.round(totals.previous.engagement / totals.previous.activeUsers) : 0;
    const totalHostUsers = totals.current.gameUsers + totals.current.siteUsers;

    return {
      kpis: {
        activeUsers: {
          value: totals.current.activeUsers,
          deltaPct: deltaPct(totals.current.activeUsers, totals.previous.activeUsers),
        },
        returningRatePct: {
          value: currRetPct,
          deltaPct: Math.round((currRetPct - prevRetPct) * 10) / 10,
        },
        avgEngagementSec: {
          value: currAvgSec,
          formatted: formatDuration(currAvgSec),
          deltaPct: deltaPct(currAvgSec, prevAvgSec),
        },
        hostShare: {
          gamePct: pct(totals.current.gameUsers, totalHostUsers),
          sitePct: pct(totals.current.siteUsers, totalHostUsers),
        },
      },
      dailySeries: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)),
    };
  }

  if (report === "sources") {
    const data = await gaFetch(accessToken, "runReport", {
      dateRanges: [{ startDate: currentStart, endDate: "today" }],
      dimensions: [{ name: "sessionSourceMedium" }, { name: "sessionCampaignName" }, { name: "hostName" }],
      metrics: [
        { name: "activeUsers" },
        { name: "sessions" },
        { name: "engagedSessions" },
        { name: "averageSessionDuration" },
      ],
      dimensionFilter: hostFilter(hosts),
      orderBys: [{ metric: { metricName: "activeUsers" }, desc: true }],
      limit: 25,
    });
    const rows: GaRow[] = data.rows || [];
    const grouped = new Map<string, {
      sourceMedium: string;
      label: string;
      campaign: string;
      users: number;
      sessions: number;
      engagedSessions: number;
      gameSessions: number;
      durationWeighted: number;
    }>();

    for (const r of rows) {
      const sm = dim(r, 0) || "(direct) / (none)";
      const camp = dim(r, 1);
      const host = dim(r, 2).toLowerCase();
      const users = met(r, 0);
      const sessions = met(r, 1);
      const engaged = met(r, 2);
      const avgDur = met(r, 3);
      const key = `${sm}::${camp && camp !== "(not set)" ? camp : ""}`;
      const item = grouped.get(key) || {
        sourceMedium: sm,
        label: formatSourceLabel(sm),
        campaign: camp && camp !== "(not set)" ? camp : "",
        users: 0,
        sessions: 0,
        engagedSessions: 0,
        gameSessions: 0,
        durationWeighted: 0,
      };
      item.users += users;
      item.sessions += sessions;
      item.engagedSessions += engaged;
      if (host.includes("play.")) item.gameSessions += sessions;
      item.durationWeighted += avgDur * sessions;
      grouped.set(key, item);
    }

    const sources = Array.from(grouped.values())
      .map((s) => ({
        sourceMedium: s.sourceMedium,
        label: s.label,
        campaign: s.campaign,
        users: s.users,
        sessions: s.sessions,
        engagementRatePct: pct(s.engagedSessions, s.sessions),
        gameSharePct: pct(s.gameSessions, s.sessions),
        avgDurationFormatted: formatDuration(s.sessions > 0 ? s.durationWeighted / s.sessions : 0),
      }))
      .sort((a, b) => b.users - a.users)
      .slice(0, 15);

    return { sources };
  }

  if (report === "game_modes") {
    const data = await gaFetch(accessToken, "runReport", {
      dateRanges: [{ startDate: currentStart, endDate: "today" }],
      dimensions: [{ name: "customEvent:game_mode" }, { name: "eventName" }],
      metrics: [{ name: "activeUsers" }, { name: "eventCount" }, { name: "customEvent:duration_sec" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: "play.ksool.minibig.pw" } } },
            { filter: { fieldName: "eventName", inListFilter: { values: ["level_start", "level_end"] } } },
          ],
        },
      },
    });
    const rows: GaRow[] = data.rows || [];
    const byMode = new Map<string, { users: number; starts: number; ends: number; durationSum: number }>();

    for (const r of rows) {
      const mode = dim(r, 0) || "unknown";
      const ev = dim(r, 1);
      const users = met(r, 0);
      const count = met(r, 1);
      const dur = met(r, 2);
      const cur = byMode.get(mode) || { users: 0, starts: 0, ends: 0, durationSum: 0 };
      cur.users = Math.max(cur.users, users);
      if (ev === "level_start") cur.starts += count;
      if (ev === "level_end") {
        cur.ends += count;
        cur.durationSum += dur;
      }
      byMode.set(mode, cur);
    }

    const donutMap = new Map<string, { key: string; label: string; plays: number; users: number; durationSum: number; ends: number }>();
    for (const [mode, val] of byMode.entries()) {
      const isParty = mode.startsWith("party_");
      const groupKey = isParty ? "party_all" : mode;
      const groupLabel = isParty ? "🍻 술자리 파티게임 (전체)" : (GAME_MODE_LABELS[mode] || mode);
      const item = donutMap.get(groupKey) || { key: groupKey, label: groupLabel, plays: 0, users: 0, durationSum: 0, ends: 0 };
      item.plays += val.starts || val.ends;
      item.users += val.users;
      item.durationSum += val.durationSum;
      item.ends += val.ends;
      donutMap.set(groupKey, item);
    }

    const totalPlays = Array.from(donutMap.values()).reduce((s, x) => s + x.plays, 0);
    const modes = Array.from(donutMap.values())
      .map((x) => ({
        key: x.key,
        label: x.label,
        plays: x.plays,
        users: x.users,
        sharePct: pct(x.plays, totalPlays),
        avgDurationFormatted: formatDuration(x.ends > 0 ? x.durationSum / x.ends : 0),
      }))
      .sort((a, b) => b.plays - a.plays);

    return { totalPlays, modes };
  }

  if (report === "funnel_and_levels") {
    const [funnelRes, levelRes] = await Promise.all([
      gaFetch(accessToken, "runReport", {
        dateRanges: [{ startDate: currentStart, endDate: "today" }],
        dimensions: [{ name: "eventName" }],
        metrics: [{ name: "activeUsers" }, { name: "eventCount" }],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: "play.ksool.minibig.pw" } } },
              {
                filter: {
                  fieldName: "eventName",
                  inListFilter: { values: ["first_visit", "tutorial_begin", "tutorial_complete", "level_start", "level_end"] },
                },
              },
            ],
          },
        },
      }),
      gaFetch(accessToken, "runReport", {
        dateRanges: [{ startDate: currentStart, endDate: "today" }],
        dimensions: [
          { name: "customEvent:game_mode" },
          { name: "customEvent:level_id" },
          { name: "customEvent:result" },
        ],
        metrics: [
          { name: "eventCount" },
          { name: "activeUsers" },
          { name: "customEvent:duration_sec" },
          { name: "customEvent:score" },
        ],
        dimensionFilter: {
          andGroup: {
            expressions: [
              { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: "play.ksool.minibig.pw" } } },
              { filter: { fieldName: "eventName", stringFilter: { matchType: "EXACT", value: "level_end" } } },
              { filter: { fieldName: "customEvent:game_mode", inListFilter: { values: ["quiz", "tycoon", "tycoon_infinite", "sos"] } } },
            ],
          },
        },
        orderBys: [{ dimension: { dimensionName: "customEvent:level_id" } }],
      }),
    ]);

    const evUsers = new Map<string, number>();
    for (const r of (funnelRes.rows || []) as GaRow[]) {
      evUsers.set(dim(r, 0), met(r, 0));
    }
    const funnelDefs = [
      { key: "first_visit", label: "1. 게임 첫 방문" },
      { key: "tutorial_begin", label: "2. 튜토리얼 시작" },
      { key: "tutorial_complete", label: "3. 튜토리얼 완료" },
      { key: "level_start", label: "4. 첫 스테이지 시작" },
      { key: "level_end", label: "5. 첫 스테이지 완료" },
    ];
    const baseUsers = evUsers.get("first_visit") || Math.max(1, evUsers.get("level_start") || 0);
    const onboardingFunnel = funnelDefs.map((step, i) => {
      const users = evUsers.get(step.key) || 0;
      const prevUsers = i === 0 ? users : (evUsers.get(funnelDefs[i - 1].key) || 0);
      const drop = i === 0 || prevUsers <= 0 ? 0 : Math.max(0, pct(prevUsers - users, prevUsers));
      return {
        step: step.label,
        users,
        rateFromStartPct: baseUsers > 0 ? Math.min(100, pct(users, baseUsers)) : 0,
        dropOffPct: drop,
      };
    });

    const stageMap = new Map<string, {
      gameMode: string;
      levelId: string;
      winCount: number;
      loseCount: number;
      quitCount: number;
      durationSum: number;
    }>();
    for (const r of (levelRes.rows || []) as GaRow[]) {
      const mode = dim(r, 0);
      const levelId = dim(r, 1);
      const result = dim(r, 2);
      const count = met(r, 0);
      const dur = met(r, 2);
      const key = `${mode}::${levelId}`;
      const item = stageMap.get(key) || { gameMode: mode, levelId, winCount: 0, loseCount: 0, quitCount: 0, durationSum: 0 };
      if (result === "win") item.winCount += count;
      else if (result === "lose") item.loseCount += count;
      else item.quitCount += count;
      item.durationSum += dur;
      stageMap.set(key, item);
    }

    const stageBreakdown = Array.from(stageMap.values()).map((s) => {
      const total = s.winCount + s.loseCount + s.quitCount;
      const clearRatePct = pct(s.winCount, total);
      const failOrQuitPct = total > 0 ? pct(s.loseCount + s.quitCount, total) : 0;
      return {
        gameMode: s.gameMode,
        gameModeLabel: GAME_MODE_LABELS[s.gameMode] || s.gameMode,
        levelId: s.levelId,
        levelLabel: LEVEL_ID_LABELS[s.levelId] || s.levelId,
        winCount: s.winCount,
        loseCount: s.loseCount,
        quitCount: s.quitCount,
        clearRatePct,
        avgDurationFormatted: formatDuration(total > 0 ? s.durationSum / total : 0),
        warningBadge: total >= 5 && failOrQuitPct >= 50 ? "⚠️ 난이도 점검 필요 (이탈·실패 50%↑)" : null,
      };
    });

    return { onboardingFunnel, stageBreakdown };
  }

  if (report === "party_games") {
    const data = await gaFetch(accessToken, "runReport", {
      dateRanges: [{ startDate: currentStart, endDate: "today" }],
      dimensions: [
        { name: "customEvent:game_mode" },
        { name: "eventName" },
        { name: "customEvent:result" },
      ],
      metrics: [{ name: "activeUsers" }, { name: "eventCount" }, { name: "customEvent:duration_sec" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            { filter: { fieldName: "hostName", stringFilter: { matchType: "EXACT", value: "play.ksool.minibig.pw" } } },
            { filter: { fieldName: "customEvent:game_mode", stringFilter: { matchType: "BEGINS_WITH", value: "party_" } } },
          ],
        },
      },
    });
    const map = new Map<string, { gameMode: string; plays: number; users: number; wins: number; ends: number; durationSum: number }>();
    for (const r of (data.rows || []) as GaRow[]) {
      const mode = dim(r, 0);
      const ev = dim(r, 1);
      const result = dim(r, 2);
      const users = met(r, 0);
      const count = met(r, 1);
      const dur = met(r, 2);
      const item = map.get(mode) || { gameMode: mode, plays: 0, users: 0, wins: 0, ends: 0, durationSum: 0 };
      item.users = Math.max(item.users, users);
      if (ev === "level_start") item.plays += count;
      if (ev === "level_end") {
        item.ends += count;
        item.durationSum += dur;
        if (result === "win") item.wins += count;
      }
      map.set(mode, item);
    }

    const partyGames = Array.from(map.values())
      .map((x) => {
        const totalPlays = x.plays || x.ends;
        return {
          gameMode: x.gameMode,
          label: GAME_MODE_LABELS[x.gameMode] || x.gameMode,
          plays: totalPlays,
          users: x.users,
          avgDurationFormatted: formatDuration(x.ends > 0 ? x.durationSum / x.ends : 0),
          completionRatePct: pct(x.wins || x.ends, totalPlays),
        };
      })
      .sort((a, b) => b.plays - a.plays);

    return { partyGames };
  }

  if (report === "conversions") {
    const data = await gaFetch(accessToken, "runReport", {
      dateRanges: [{ startDate: currentStart, endDate: "today" }],
      dimensions: [
        { name: "eventName" },
        { name: "customEvent:ad_type" },
        { name: "customEvent:recipe_id" },
        { name: "customEvent:item_name" },
      ],
      metrics: [{ name: "eventCount" }, { name: "activeUsers" }],
      dimensionFilter: {
        andGroup: {
          expressions: [
            hostFilter(hosts),
            {
              filter: {
                fieldName: "eventName",
                inListFilter: {
                  values: [
                    "ad_reward_start",
                    "ad_reward_complete",
                    "select_content",
                    "share",
                    "login",
                    "sign_up",
                    "unlock_achievement",
                  ],
                },
              },
            },
          ],
        },
      },
    });

    let adStarts = 0;
    let adCompletes = 0;
    const adMap = new Map<string, { adType: string; starts: number; completes: number }>();
    let storyLinkClicks = 0;
    let affiliateBuyClicks = 0;
    const recipeClicks = new Map<string, { recipeId: string; itemName: string; storyClicks: number; affiliateClicks: number }>();
    let shareCount = 0;
    let googleSignUps = 0;
    let googleLogins = 0;
    let recipeUnlocks = 0;

    for (const r of (data.rows || []) as GaRow[]) {
      const ev = dim(r, 0);
      const adType = dim(r, 1);
      const recipeId = dim(r, 2);
      const itemName = dim(r, 3);
      const count = met(r, 0);

      if (ev === "ad_reward_start") {
        adStarts += count;
        const key = adType || "unknown";
        const cur = adMap.get(key) || { adType: key, starts: 0, completes: 0 };
        cur.starts += count;
        adMap.set(key, cur);
      } else if (ev === "ad_reward_complete") {
        adCompletes += count;
        const key = adType || "unknown";
        const cur = adMap.get(key) || { adType: key, starts: 0, completes: 0 };
        cur.completes += count;
        adMap.set(key, cur);
      } else if (ev === "select_content") {
        const isAffiliate = adType === "affiliate_buy" || itemName.includes("affiliate");
        const isStory = adType === "story_link" || recipeId !== "";
        if (isAffiliate) affiliateBuyClicks += count;
        else if (isStory) storyLinkClicks += count;

        if (recipeId && recipeId !== "(not set)") {
          const rec = recipeClicks.get(recipeId) || { recipeId, itemName: itemName || `#${recipeId}`, storyClicks: 0, affiliateClicks: 0 };
          if (isAffiliate) rec.affiliateClicks += count;
          else rec.storyClicks += count;
          recipeClicks.set(recipeId, rec);
        }
      } else if (ev === "share") {
        shareCount += count;
      } else if (ev === "sign_up") {
        googleSignUps += count;
      } else if (ev === "login") {
        googleLogins += count;
      } else if (ev === "unlock_achievement") {
        recipeUnlocks += count;
      }
    }

    const byPlacement = Array.from(adMap.values())
      .map((a) => ({
        adType: a.adType,
        label: AD_TYPE_LABELS[a.adType] || a.adType,
        starts: a.starts,
        completes: a.completes,
        ratePct: pct(a.completes, a.starts),
      }))
      .sort((a, b) => b.starts - a.starts);

    const topClickedRecipes = Array.from(recipeClicks.values())
      .sort((a, b) => (b.storyClicks + b.affiliateClicks) - (a.storyClicks + a.affiliateClicks))
      .slice(0, 8);

    return {
      adSummary: {
        starts: adStarts,
        completes: adCompletes,
        completionRatePct: pct(adCompletes, adStarts),
        byPlacement,
      },
      outboundClicks: { storyLinkClicks, affiliateBuyClicks, topClickedRecipes },
      socialAndAccount: { shareCount, googleSignUps, googleLogins, recipeUnlocks },
    };
  }

  throw new Error(`지원하지 않는 report 유형: ${report}`);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "METHOD_NOT_ALLOWED" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, error: "SUPABASE_ENV_MISSING" }, 500);
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!token) return jsonResponse({ ok: false, error: "UNAUTHORIZED" }, 401);

  const authClient = createClient(supabaseUrl, anonKey || serviceRoleKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser(token);
  const email = userData?.user?.email?.toLowerCase() ?? "";
  if (userErr || !email) return jsonResponse({ ok: false, error: "INVALID_TOKEN" }, 401);

  const allowedAdmins = new Set(
    (Deno.env.get("ADMIN_EMAILS") ?? DEFAULT_ADMIN_EMAILS.join(","))
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  if (!allowedAdmins.has(email)) {
    return jsonResponse({ ok: false, error: "FORBIDDEN_ADMIN_ONLY" }, 403);
  }

  const saRaw = Deno.env.get("GA_SERVICE_ACCOUNT_JSON") ?? "";
  if (!saRaw.trim()) {
    return jsonResponse({
      ok: false,
      error: "GA_SERVICE_ACCOUNT_JSON_NOT_SET",
      message: "GA_SERVICE_ACCOUNT_JSON 시크릿이 아직 등록되지 않았습니다. Google Cloud 서비스 계정 JSON 키를 등록하고 GA4 속성(564332931) 뷰어 권한을 부여해 주세요.",
    }, 503);
  }

  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(saRaw);
    if (!sa.client_email || !sa.private_key) throw new Error("Missing client_email or private_key");
  } catch (e) {
    return jsonResponse({ ok: false, error: "INVALID_GA_SERVICE_ACCOUNT_JSON", message: String(e) }, 500);
  }

  let payload: { report?: string; range?: string; hostScope?: string; forceRefresh?: boolean } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const report = String(payload.report || "overview");
  const range = ["7d", "28d", "90d"].includes(String(payload.range)) ? String(payload.range) : "28d";
  const hostScope = ["all", "game", "site"].includes(String(payload.hostScope)) ? String(payload.hostScope) : "all";
  const forceRefresh = Boolean(payload.forceRefresh);
  const cacheKey = `${report}:${range}:${hostScope}`;
  const ttlSec = report === "realtime" ? 60 : 900;

  const adminDb = createClient(supabaseUrl, serviceRoleKey);
  if (!forceRefresh) {
    const { data: cached } = await adminDb
      .from("ga_cache")
      .select("payload, expires_at, updated_at")
      .eq("cache_key", cacheKey)
      .maybeSingle();

    if (cached && new Date(cached.expires_at).getTime() > Date.now()) {
      return jsonResponse({ ok: true, cached: true, updatedAt: cached.updated_at, data: cached.payload });
    }
  }

  try {
    const accessToken = await getGoogleAccessToken(sa);
    const data = await buildReport(accessToken, report, range, hostScope);
    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + ttlSec * 1000).toISOString();
    await adminDb.from("ga_cache").upsert({
      cache_key: cacheKey,
      payload: data,
      expires_at: expiresIso,
      updated_at: nowIso,
    });
    return jsonResponse({ ok: true, cached: false, updatedAt: nowIso, data });
  } catch (e) {
    return jsonResponse({ ok: false, error: "GA4_QUERY_FAILED", message: (e as Error).message }, 502);
  }
});

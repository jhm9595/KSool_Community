(() => {
  'use strict';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHttpsUrl = rawUrl => {
    try {
      const u = new URL(String(rawUrl || '').trim());
      return u.protocol === 'https:' ? u.href : '';
    } catch (_) { return ''; }
  };
  const renderBodyWithSafeHelpLinks = rawText => {
    const escaped = esc(rawText);
    return escaped.replace(/https:\/\/play\.ksool\.minibig\.pw\/\?help=([A-Za-z0-9_-]{4,500})/g, (full, token) => {
      try {
        const u = new URL(`https://play.ksool.minibig.pw/?help=${token}`);
        if (u.protocol !== 'https:' || u.origin !== 'https://play.ksool.minibig.pw') return full;
        return `<a href="${esc(u.href)}" target="_blank" rel="noopener noreferrer" class="text-link" style="font-weight:800;text-decoration:underline;">🆘 친구 SOS 도와주기 ↗</a>`;
      } catch (_) { return full; }
    });
  };
  const getSafeOAuthRedirectUrl = () => {
    const allowed = new Set(['https://ksool.minibig.pw', 'http://localhost:8766', 'http://127.0.0.1:8766']);
    const origin = (typeof location !== 'undefined' && allowed.has(location.origin)) ? location.origin : 'https://ksool.minibig.pw';
    return `${origin}/`;
  };
  const uiIcon = (type,size=18) => {
    const paths={refresh:'<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5 8a8 8 0 0 1 13-3l2 2M4 17l2 2a8 8 0 0 0 13-3"/>',up:'<path d="M7 10v11H3V10zm0 1 5-8c3 0 2 4 1 6h6c2 0 2 2 1 5l-2 7H7"/>',down:'<path d="M7 14V3H3v11zm0-1 5 8c3 0 2-4 1-6h6c2 0 2-2 1-5l-2-7H7"/>',comment:'<path d="M3 4h18v13H9l-6 4z"/>',flag:'<path d="M5 22V3m0 0c5-4 9 4 15 0v11c-6 4-10-4-15 0"/>',bookmark:'<path d="M6 3h12v18l-6-4-6 4z"/>',search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',arrowUpRight:'<path d="M6 18 18 6M6 6h12v12"/>',arrowDown:'<path d="M12 4v16m-7-7 7 7 7-7"/>',plus:'<path d="M12 4v16M4 12h16"/>',share:'<path d="M12 15V3m-5 5 5-5 5 5M5 12v8h14v-8"/>',heart:'<path d="M20.5 5.5c-3-3-6-1-8.5 1.5-2.5-2.5-5.5-4.5-8.5-1.5C-1 10 7 17 12 21c5-4 13-11 8.5-15.5z"/>',check:'<path d="m5 12 4 4L20 5"/>',flask:'<path d="M9 3h6m-5 0v7L4 20h16l-6-10V3M8 14h8"/>',close:'<path d="m5 5 14 14M5 19 19 5"/>',trash:'<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7m4-7v7"/>',sparkles:'<path d="m12 3 3 6 6 3-6 3-3 6-3-6-6-3 6-3z"/>'};
    return `<svg class="ui-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[type]||paths.plus}</svg>`;
  };
  const data = window.GAME_DATA;
  const gameI18n = window.GAME_I18N || {};
  const gameLinks = window.GAME_LINKS || { partners: {}, items: {}, stories: {} };
  const ingredients = new Map(data.ingredients_base.map(i => [i.ingredient_id, i]));
  const details = new Map(data.ingredients_detail.map(i => [i.detail_id, i]));
  const recipes = data.recipes.map(r => ({...r, items:data.recipe_ingredients.filter(i => i.recipe_id === r.recipe_id).sort((a,b) => a.slot_order - b.slot_order)}));
  const byId = new Map(recipes.map(r => [r.recipe_id,r]));
  const icon = (item, size=40) => window.KSool.pixelIcon(item,size,'',{theme:'hd'});
  const SUPPORTED_LANGS = ['ko', 'en', 'ja', 'zh-CN', 'zh-TW'];
  function detectInitialLang() {
    try {
      const saved = localStorage.getItem('ksool_lang_v1');
      if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
    } catch (_) {}
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      if (tz === 'Asia/Seoul' || tz === 'Asia/Pyongyang') return 'ko';
      if (tz === 'Asia/Tokyo') return 'ja';
      if (tz === 'Asia/Taipei' || tz === 'Asia/Hong_Kong' || tz === 'Asia/Macau') return 'zh-TW';
      if (tz === 'Asia/Shanghai') return 'zh-CN';
    } catch (_) {}
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('ko')) return 'ko';
    if (nav.startsWith('ja')) return 'ja';
    if (nav.startsWith('zh-hant') || nav === 'zh-tw' || nav === 'zh-hk') return 'zh-TW';
    if (nav.startsWith('zh')) return 'zh-CN';
    return 'en';
  }
  let portalLang = detectInitialLang();
  const PORTAL_UI = {
    ko: { recipes:'조합', tips:'커뮤니티', suggestions:'추천', rankings:'랭킹', updates:'업데이트', blog:'블로그 ↗', heroTitle:'조합, 한눈에.', search:'조합 · 재료 검색', write:'글쓰기', storyBtn:'🎬 유래 · 레시피 영상 보기', rankTitle:'🏆 인기 조합 & 추천 랭킹', updateTitle:'📢 K-술 업데이트 소식' },
    en: { recipes:'Recipes', tips:'Community', suggestions:'Combos', rankings:'Rankings', updates:'Updates', blog:'Blog ↗', heroTitle:'K-Drinks at a Glance.', search:'Search recipes or ingredients', write:'Post', storyBtn:'🎬 Story, Origin & Video Guide', rankTitle:'🏆 Top Combos & Rankings', updateTitle:'📢 K-Sool Updates & Patch Notes' },
    ja: { recipes:'レシピ', tips:'コミュニティ', suggestions:'おすすめ', rankings:'ランキング', updates:'お知らせ', blog:'ブログ ↗', heroTitle:'韓国お酒レシピ一覧', search:'レシピ・材料を検索', write:'投稿', storyBtn:'🎬 由来・作り方動画を見る', rankTitle:'🏆 人気レシピ＆ランキング', updateTitle:'📢 K-酒 アップデート情報' },
    'zh-CN': { recipes:'配方', tips:'社区', suggestions:'推荐', rankings:'排行榜', updates:'更新公告', blog:'博客 ↗', heroTitle:'韩国调酒配方一览', search:'搜索配方或材料', write:'发帖', storyBtn:'🎬 查看由来与视频教程', rankTitle:'🏆 人气配方排行榜', updateTitle:'📢 K-酒 更新公告' },
    'zh-TW': { recipes:'配方', tips:'社群', suggestions:'推薦', rankings:'排行榜', updates:'更新公告', blog:'部落格 ↗', heroTitle:'韓國調酒配方一覽', search:'搜尋配方或材料', write:'發文', storyBtn:'🎬 查看由來與影片教學', rankTitle:'🏆 人氣配方排行榜', updateTitle:'📢 K-酒 更新公告' }
  };
  const pt = k => (PORTAL_UI[portalLang] && PORTAL_UI[portalLang][k]) || PORTAL_UI.en[k] || k;
  const name = i => {
    const koFallback = i?.display_name || i?.name || 'Unknown';
    if (!i || portalLang === 'ko') return koFallback;
    const entities = gameI18n[portalLang]?.entities || {};
    const enEntities = gameI18n.en?.entities || {};
    const key = i.detail_id != null ? `det:${i.detail_id}` : i.recipe_id != null ? `rec:${i.recipe_id}` : i.ingredient_id != null ? `ing:${i.ingredient_id}` : null;
    return (key && (entities[key] || enEntities[key])) || koFallback;
  };
  const ingredientFor = item => details.get(item.detail_id || item.detail_ingredient_id) || ingredients.get(item.ingredient_id);
  const colors = ['#d5f88a','#ffdb69','#bce8f0','#f5b9d1','#d3bffc','#ffb78b','#aeddc1','#c5d5fc','#f1e58a'];
  const storageKey = 'ksool-external-community-draft-v1';
  let stored = {};
  try { stored = JSON.parse(localStorage.getItem(storageKey) || '{}') || {}; } catch (_) {}
  let posts = [];
  let suggestions = [], serverConnected=false, refreshQueue=Promise.resolve();
  const api = async (path, options={}) => {
    const response=await fetch('/api'+path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json',...options.headers}});
    const result=await response.json();if(!response.ok)throw new Error(result.error||'연결 실패');return result;
  };
  function syncCommunity(){const next=refreshQueue.then(loadCommunity);refreshQueue=next.catch(()=>{});return next;}
  async function loadCommunity(){
    try{const [feed,combos]=await Promise.all([api('/posts'),api('/suggestions')]);posts=feed.posts;suggestions=combos.suggestions.map(s=>({...s,myVote:combos.userVotes[s.suggestion_key]||null}));let before=feed.nextBefore;while(before){const page=await api('/posts?before='+encodeURIComponent(before));posts.push(...page.posts);before=page.nextBefore;}before=combos.nextBefore;while(before){const page=await api('/suggestions?before='+encodeURIComponent(before));suggestions.push(...page.suggestions.map(s=>({...s,myVote:page.userVotes[s.suggestion_key]||null})));before=page.nextBefore;}serverConnected=true;$('#connection-status').textContent='● 커뮤니티 연결됨';render();}
    catch(error){serverConnected=false;$('#connection-status').textContent='○ 서버 연결 실패';toast('커뮤니티 연결 실패 · 새로고침해 주세요');}
  }
  const bookmarks = new Set(Array.isArray(stored.bookmarks) ? stored.bookmarks.filter(i => typeof i === 'string') : []);
  const helpful = new Set(Array.isArray(stored.helpful) ? stored.helpful.filter(i => typeof i === 'string') : []);
  const progressStorageKey = 'ksool-community-progress-v1';
  const FREE_STARTER_INGREDIENTS = [202, 206, 205, 701, 301]; // 물, 눈, 공기, 설탕, 레몬
  const normalizeRecIds = (arr) => (Array.isArray(arr) ? [...new Set(arr.map(v => Number(String(v).replace(/^rec:/, ''))).filter(n => byId.has(n)))] : []);
  const normalizeIngIds = (arr) => (Array.isArray(arr) ? arr.map(v => Number(String(v).replace(/^ing:/, ''))).filter(n => Number.isInteger(n) && n > 0) : []);
  function decodeSyncInput(rawInput) {
    const text = String(rawInput || '').trim();
    if (!text) return null;
    let token = text;
    if (/^https?:\/\//i.test(text) || text.includes('sync=')) {
      try {
        const u = new URL(text.startsWith('http') ? text : `https://ksool.minibig.pw/${text.replace(/^[/?#]+/, '')}`);
        token = u.searchParams.get('sync') || token;
      } catch (_) {
        const m = text.match(/[?&#]sync=([^&#\s]+)/);
        if (m) token = decodeURIComponent(m[1]);
      }
    }
    if (token.startsWith('KSOOL_SYNC_V1:')) token = token.slice('KSOOL_SYNC_V1:'.length).trim();
    try {
      const norm = token.replace(/-/g, '+').replace(/_/g, '/');
      const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
      const bin = atob(norm + pad);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const payload = JSON.parse(new TextDecoder().decode(bytes));
      if (!payload || payload.v !== 1) return null;
      return {
        tycoon: normalizeRecIds(payload.tycoon?.unlockedRecipeIds),
        quiz: normalizeRecIds(payload.quiz?.unlockedRecipeIds),
        tycoonIngredients: normalizeIngIds([...(payload.tycoon?.unlockedIngredientIds || []), ...(payload.tycoon?.purchasedIngredientIds || [])]),
        quizIngredients: normalizeIngIds([...(payload.quiz?.unlockedIngredientIds || []), ...(payload.quiz?.purchasedIngredientIds || [])]),
        ts: payload.ts || Date.now()
      };
    } catch (_) { return null; }
  }
  let syncedProgress = (() => {
    try {
      const raw = JSON.parse(localStorage.getItem(progressStorageKey) || 'null');
      if (raw && typeof raw === 'object') {
        return {
          mode: raw.mode === 'tycoon' ? 'tycoon' : 'quiz',
          tycoon: normalizeRecIds(raw.tycoon),
          quiz: normalizeRecIds(raw.quiz),
          tycoonIngredients: normalizeIngIds(raw.tycoonIngredients),
          quizIngredients: normalizeIngIds(raw.quizIngredients)
        };
      }
    } catch (_) {}
    return { mode: 'quiz', tycoon: [], quiz: [], tycoonIngredients: [], quizIngredients: [] };
  })();
  const saveSyncedProgress = () => { try { localStorage.setItem(progressStorageKey, JSON.stringify(syncedProgress)); } catch (_) {} };
  const SUPABASE_URL = 'https://jyjxvwxlwkoedxwkkysj.supabase.co';
  const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anh2d3hsd2tvZWR4d2treXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NzY5NDUsImV4cCI6MjEwOTA1Mjk0NX0.wfaRfya2PV4Ykawd6md4fXrO91_TWnyGyusSRa-2fJ8';
  const sbClient = typeof window !== 'undefined' && window.supabase?.createClient
    ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
    : null;
  let sbUser = null;
  let adminAccessToken = null;
  let isAdminUser = false;
  let isSuperAdmin = false;
  let adminPermissions = [];
  let activeAdminTab = 'reports';
  let adminData = { reports: [], posts: [], suggestions: [], updates: [], roles: [], gameSuggestions: [] };
  let dbUpdates = [];
  let gameSuggestions = [];
  let tycoonRankings = { TIME_ATTACK: [], INFINITE: [] };
  let activeRankMode = 'TIME_ATTACK';
  let rankSearchQuery = (() => { try { return localStorage.getItem('ksool_tycoon_player_name') || ''; } catch (_) { return ''; } })();

  const canAdmin = (perm) => isSuperAdmin || adminPermissions.includes(perm);
  const adminApi = async (path, options = {}) => {
    if (!adminAccessToken && sbClient) {
      const { data } = await sbClient.auth.getSession();
      adminAccessToken = data?.session?.access_token || null;
    }
    if (!adminAccessToken) throw new Error('관리자 인증 토큰이 없습니다.');
    return api(path, { ...options, headers: { ...(options.headers || {}), Authorization: `Bearer ${adminAccessToken}` } });
  };
  async function checkAdminStatus(token) {
    if (!token && sbClient) {
      try {
        const { data } = await sbClient.auth.getSession();
        token = data?.session?.access_token || null;
      } catch (_) {}
    }
    adminAccessToken = token || null;
    if (!adminAccessToken) { isAdminUser = false; isSuperAdmin = false; adminPermissions = []; const btn = $('#admin-nav-btn'); if (btn) btn.hidden = true; return; }
    try {
      const res = await adminApi('/admin/me');
      isAdminUser = Boolean(res?.isAdmin);
      isSuperAdmin = Boolean(res?.isSuperAdmin);
      adminPermissions = Array.isArray(res?.permissions) ? res.permissions : [];
      if (isAdminUser && !canAdmin(activeAdminTab) && activeAdminTab !== 'roles') {
        activeAdminTab = ['reports','suggestions','updates','roles'].find(t => t === 'roles' ? isSuperAdmin : canAdmin(t === 'reports' ? 'posts' : t)) || 'reports';
      }
    } catch (_) { isAdminUser = false; isSuperAdmin = false; adminPermissions = []; }
    const btn = $('#admin-nav-btn');
    if (btn) btn.hidden = !isAdminUser;
    if (isAdminUser && activeTab === 'admin') loadAdminData();
    else render();
  }
  async function loadAdminData() {
    if (!isAdminUser || !adminAccessToken) return;
    try {
      const overview = await adminApi('/admin/overview');
      adminData.reports = overview.reports || [];
      adminData.posts = overview.posts || [];
      adminData.suggestions = overview.suggestions || [];
      adminData.updates = overview.updates || [];
      adminData.roles = overview.roles || [];
      if (sbClient && canAdmin('suggestions')) {
        const gsRes = await sbClient.from('ksool_suggestions').select('*').order('upvotes', { ascending: false }).limit(100);
        if (Array.isArray(gsRes.data)) adminData.gameSuggestions = gsRes.data;
      }
      render();
    } catch (e) { toast(e.message || '관리자 데이터 로드 실패'); }
  }

  function mergeProgressRow(row) {
    if (!row) return;
    // A cloud row is a snapshot, not a delta. Do not retain another account's records.
    syncedProgress.tycoon = normalizeRecIds(row.tycoon_state?.unlockedRecipeIds ?? row.tycoon_unlocked);
    syncedProgress.quiz = normalizeRecIds(row.quiz_state?.unlockedRecipeIds ?? row.quiz_unlocked);
    syncedProgress.tycoonIngredients = normalizeIngIds([...(row.tycoon_state?.unlockedIngredientIds || []), ...(row.tycoon_state?.purchasedIngredientIds || [])]);
    syncedProgress.quizIngredients = normalizeIngIds([...(row.quiz_state?.unlockedIngredientIds || []), ...(row.quiz_state?.purchasedIngredientIds || [])]);
    saveSyncedProgress();
  }

  let progressRequest = false;
  let progressSyncStarted = false;
  let lastGameMessageAt = 0;
  let followGameMode = true;
  let currentGameMode = null;
  let progressEpoch = 0;
  const gameOrigin = 'https://play.ksool.minibig.pw';
  let progressRequestId = crypto.randomUUID();
  let progressReceiver = window.KSoolProgressProtocol.createReceiver(progressRequestId);
  const hasLiveGame = () => lastGameMessageAt > 0 && Date.now() - lastGameMessageAt < 15000;
  let progressStatus = '저장된 기록 · 실시간 게임 연결 대기';
  async function refreshCloudProgress() {
    if (!sbClient || !sbUser || progressRequest || document.hidden || hasLiveGame()) return;
    progressRequest = true;
    const userId = sbUser.id;
    const requestEpoch = progressEpoch;
    try {
      const { data: row, error } = await sbClient.from('ksool_user_progress')
        .select('tycoon_state,quiz_state,tycoon_unlocked,quiz_unlocked').eq('user_id', userId).maybeSingle();
      if (userId !== sbUser?.id || hasLiveGame() || requestEpoch !== progressEpoch) return;
      if (error) throw error;
      if (row) mergeProgressRow(row);
      progressStatus = row ? '클라우드 저장 기록 · 5초마다 확인 (게임 저장 후 반영)' : '클라우드 기록 없음 · 게임에서 같은 계정으로 저장해 주세요';
    } catch (_) { progressStatus = '클라우드 갱신 실패 · 기존 기록 표시 중'; }
    finally { progressRequest = false; render(); }
  }
  async function syncFromSupabaseUser() {
    if (!sbClient) return;
    if (progressSyncStarted) return refreshCloudProgress();
    progressSyncStarted = true;
    const { data } = await sbClient.auth.getSession();
    sbUser = data?.session?.user || null;
    await checkAdminStatus(data?.session?.access_token);
    await refreshCloudProgress();
    sbClient.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      const changed = nextUser?.id !== sbUser?.id;
      sbUser = nextUser;
      setTimeout(() => checkAdminStatus(session?.access_token), 0);
      if (changed && !hasLiveGame()) {
        progressEpoch++;
        syncedProgress = { mode: syncedProgress.mode, tycoon: [], quiz: [], tycoonIngredients: [], quizIngredients: [] };
        saveSyncedProgress();
        progressStatus = '계정 변경 · 기록 확인 중';
        // Run outside the auth callback to avoid locking the auth client.
        setTimeout(() => { refreshCloudProgress(); render(); }, 0);
      }
    });
    setInterval(refreshCloudProgress, 5000);
    window.addEventListener('focus', refreshCloudProgress);
    document.addEventListener('visibilitychange', refreshCloudProgress);
  }

  async function loadRemoteGameData() {
    try {
      const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
      const [sugRes, taRes, infRes, updRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/ksool_suggestions?select=*&is_applied=eq.false&order=upvotes.desc&limit=100`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/ksool_tycoon_leaderboard?mode=eq.TIME_ATTACK&select=*&order=served_count.desc,total_earnings.desc&limit=100`, { headers }),
        fetch(`${SUPABASE_URL}/rest/v1/ksool_tycoon_leaderboard?mode=eq.INFINITE&select=*&order=served_count.desc,total_earnings.desc&limit=100`, { headers }),
        api('/updates').catch(() => ({ updates: [] }))
      ]);
      if (Array.isArray(updRes?.updates)) dbUpdates = updRes.updates;
      if (sugRes.ok) {
        const rows = await sugRes.json();
        if (Array.isArray(rows)) {
          gameSuggestions = rows.filter(r => r && r.suggestion_key && Array.isArray(r.items)).map(r => ({ ...r, fromGame: true }));
        }
      }
      if (taRes.ok) {
        const rows = await taRes.json();
        if (Array.isArray(rows)) tycoonRankings.TIME_ATTACK = rows;
      }
      if (infRes.ok) {
        const rows = await infRes.json();
        if (Array.isArray(rows)) tycoonRankings.INFINITE = rows;
      }
      render();
    } catch (_) {}
  }

  function getAvailableIngredients() {
    const isTycoon = syncedProgress.mode === 'tycoon';
    const unlockedRecs = new Set(isTycoon ? syncedProgress.tycoon : syncedProgress.quiz);
    const savedIngs = isTycoon ? syncedProgress.tycoonIngredients : syncedProgress.quizIngredients;
    const available = new Set([...FREE_STARTER_INGREDIENTS, ...savedIngs]);
    for (const ing of data.ingredients_base) {
      if (ing.unlock_recipe_id && unlockedRecs.has(Number(ing.unlock_recipe_id))) {
        available.add(Number(ing.ingredient_id));
      }
    }
    return available;
  }

  const isRecipeUnlocked = (recipeId) => {
    const list = syncedProgress.mode === 'tycoon' ? syncedProgress.tycoon : syncedProgress.quiz;
    return list.includes(Number(recipeId));
  };
  const isItemsUnlocked = (items, availableSet = getAvailableIngredients()) => {
    return Array.isArray(items) && items.every(it => availableSet.has(Number(it.ingredient_id)));
  };
  const getDefaultNickname = () => {
    const saved = localStorage.getItem('community-nickname');
    if (saved) return saved;
    if (sbUser) return (sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || '').slice(0, 16);
    return '';
  };

  function requestGameProgress() {
    $('#game-frame')?.contentWindow?.postMessage({type: 'KSOOL_PROGRESS_REQUEST', version: 1, requestId: progressRequestId}, gameOrigin);
  }
  $('#game-frame')?.addEventListener('load', () => {
    progressRequestId = crypto.randomUUID();
    progressReceiver = window.KSoolProgressProtocol.createReceiver(progressRequestId);
    lastGameMessageAt = 0;
    progressEpoch++;
    progressStatus = '게임창 연결 대기 · 마지막 수신 기록 표시';
    requestGameProgress();
    render();
  });
  window.addEventListener('message', event => {
    if (event.origin !== gameOrigin || event.source !== $('#game-frame')?.contentWindow) return;
    const msg = event.data;
    if (!progressReceiver.accept(msg)) return;
    const next = {
      mode: followGameMode ? msg.mode : syncedProgress.mode,
      tycoon: normalizeRecIds(msg.tycoon.unlockedRecipeIds),
      quiz: normalizeRecIds(msg.quiz.unlockedRecipeIds),
      tycoonIngredients: normalizeIngIds([...msg.tycoon.unlockedIngredientIds, ...msg.tycoon.purchasedIngredientIds]),
      quizIngredients: normalizeIngIds([...msg.quiz.unlockedIngredientIds, ...msg.quiz.purchasedIngredientIds])
    };
    const changed = JSON.stringify(next) !== JSON.stringify(syncedProgress) || !hasLiveGame();
    syncedProgress = next;
    currentGameMode = msg.mode;
    lastGameMessageAt = Date.now();
    progressEpoch++;
    progressStatus = '게임창 연결됨 · 현재 플레이 기록';
    event.source.postMessage({type:'KSOOL_PROGRESS_ACK', version:1, requestId:progressRequestId, sequence:msg.sequence}, gameOrigin);
    if (changed) { saveSyncedProgress(); render(); }
  });
  setInterval(() => {
    if (!hasLiveGame()) {
      if (lastGameMessageAt) {
        lastGameMessageAt = 0;
        progressStatus = '게임창 연결 끊김 · 마지막 수신 기록 표시';
        render();
      }
      requestGameProgress();
    }
  }, 5000);
  (() => {
    try {
      const sp = new URLSearchParams(location.search);
      const syncToken = sp.get('sync');
      if (syncToken) {
        const parsed = decodeSyncInput(syncToken);
        if (parsed) {
          progressEpoch++;
          syncedProgress.tycoon = parsed.tycoon;
          syncedProgress.quiz = parsed.quiz;
          syncedProgress.tycoonIngredients = parsed.tycoonIngredients || [];
          syncedProgress.quizIngredients = parsed.quizIngredients || [];
          if (!parsed.quiz.length && parsed.tycoon.length) syncedProgress.mode = 'tycoon';
          saveSyncedProgress();
          sp.delete('sync');
          const next = location.pathname + (sp.toString() ? `?${sp.toString()}` : '') + location.hash;
          history.replaceState(null, '', next);
        }
      }
    } catch (_) {}
  })();
  const examples = [
    {id:'starter',kind:'tip',title:'비율은 숫자 그대로',body:'×2는 두 개. 카드에 적힌 개수대로 넣으세요.',author:'조합소 안내',recipeId:1,example:true},
    {id:'detail',kind:'tip',title:'안 되면 상세 재료 확인',body:'브랜드·지역 재료가 필요한 조합도 있어요. 재료 이름을 확인하세요.',author:'조합소 안내',recipeId:null,example:true},
    {id:'spoiler',kind:'tip',title:'다시 볼 조합은 책갈피',body:'카드 오른쪽 위 책갈피를 누르면 한곳에 모아볼 수 있어요.',author:'조합소 안내',recipeId:null,example:true}
  ];
  let sharedPost = null;
  const STAGE_META = {
    1: { code: 'STAGE 1', title: '길거리 무알콜 노점' },
    2: { code: 'STAGE 2', title: '이모네 포장마차' },
    3: { code: 'STAGE 3', title: '골목 전통 주점' },
    4: { code: 'STAGE 4', title: '크래프트 비어 펍' },
    5: { code: 'STAGE 5', title: '스카이라인 라운지 바' },
    6: { code: 'STAGE 6', title: '사이버펑크 미래도시 바' }
  };
  let activeViewMode = (() => {
    try { return localStorage.getItem('ksool-recipe-view-mode') === 'stage' ? 'stage' : 'grouped'; } catch (_) { return 'grouped'; }
  })();
  let showManualCodeInput = false;
  const sectionOpenState = new Map();
  const isSectionOpen = (id, defaultOpen) => (sectionOpenState.has(id) ? sectionOpenState.get(id) : defaultOpen);
  let activeTab = 'recipes', activeCategory = '전체', activeUnlockFilter = 'all', query = '', sort = 'number', limit = 16, showAnswers = true;
  const revealedSpoilers = new Set();
  let toastTimer;
  const officialRecipeKeyMap = new Map(
    recipes.map(r => [r.items.map(i => `${i.ingredient_id}:${i.detail_ingredient_id||i.detail_id||0}@${i.ratio}`).sort().join('+'), r])
  );
  function validatePost(p) {
    if (!p || typeof p !== 'object' || !['tip','experiment'].includes(p.kind) || typeof p.id !== 'string' || p.id.length > 80 || typeof p.title !== 'string' || !p.title.trim() || p.title.length > 70 || typeof p.body !== 'string' || !p.body.trim() || p.body.length > 1500 || typeof p.author !== 'string' || !p.author.trim() || p.author.length > 16) return false;
    if (p.recipeId != null && !data.recipes.some(r => r.recipe_id === p.recipeId)) return false;
    if (p.kind === 'experiment') {
      if (!Array.isArray(p.items) || p.items.length < 2 || p.items.length > 4) return false;
      const keys = new Set();
      let sum = 0;
      for (const i of p.items) {
        if (!i || !data.ingredients_base.some(b => b.ingredient_id === i.ingredient_id) || !Number.isInteger(i.ratio) || i.ratio < 1 || i.ratio > 10 || keys.has(`${i.ingredient_id}:${i.detail_id||0}`)) return false;
        keys.add(`${i.ingredient_id}:${i.detail_id||0}`);
        sum += i.ratio;
      }
      if (sum > 10) return false;
    }
    return true;
  }
  function persist() {
    try { localStorage.setItem(storageKey,JSON.stringify({bookmarks:[...bookmarks]})); return true; }
    catch (_) { toast('저장 공간이 부족해요. 이번 변경은 새로고침하면 사라질 수 있어요.'); return false; }
  }
  function toast(message) {
    $('#toast').textContent = message;
    $('#toast').classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => $('#toast').classList.remove('visible'),4000);
  }
  function allPosts() {
    const combined = [...posts,...examples];
    if (sharedPost && !combined.some(p => p.id === sharedPost.id)) combined.unshift(sharedPost);
    return combined;
  }
  function formula(items,withIcons=false) {
    return items.map(i => `${withIcons ? icon(ingredientFor(i),28) : ''}${esc(name(ingredientFor(i)))} <b>×${i.ratio}</b>`).join(' <span class="formula-plus">＋</span> ');
  }
  function mergedSuggestions() {
    const map = new Map();
    for (const s of suggestions) {
      map.set(s.suggestion_key, { ...s, fromCommunity: true });
    }
    for (const gs of gameSuggestions) {
      const existing = map.get(gs.suggestion_key);
      if (existing) {
        existing.upvotes = Math.max(existing.upvotes || 0, gs.upvotes || 0);
        existing.downvotes = Math.max(existing.downvotes || 0, gs.downvotes || 0);
        existing.fromGame = true;
      } else {
        map.set(gs.suggestion_key, { ...gs, myVote: null, fromGame: true });
      }
    }
    return [...map.values()].sort((a, b) => ((b.upvotes || 0) - (b.downvotes || 0)) - ((a.upvotes || 0) - (a.downvotes || 0)));
  }
  function filterRecipes() {
    let result = recipes.filter(r => {
      if (activeTab === 'saved' && !bookmarks.has(`r:${r.recipe_id}`)) return false;
      const unlocked = isRecipeUnlocked(r.recipe_id);
      if (activeTab === 'recipes') {
        if (activeUnlockFilter === 'unlocked' && !unlocked) return false;
        if (activeUnlockFilter === 'locked' && unlocked) return false;
      }
      const category = r.category || '';
      if (activeCategory === '기초 재료' && category !== '기초합성') return false;
      if (activeCategory === '막걸리' && !category.includes('막걸리')) return false;
      if (activeCategory === '소맥·폭탄주' && !category.includes('폭탄주')) return false;
      if (activeCategory === '과일·편의점' && !category.includes('편의점')) return false;
      if (activeCategory === '특산 명주' && category !== '특산명주') return false;
      if (!query.trim()) return true;
      const searchable = unlocked
        ? `${name(r)} ${r.formatted_number} ${category} ${r.items.map(i => name(ingredientFor(i))).join(' ')}`
        : `${name(r)} ${r.formatted_number} ${category}`;
      return searchable.toLowerCase().includes(query.toLowerCase());
    });
    if (sort === 'number') result.sort((a,b) => a.recipe_number - b.recipe_number);
    else if (sort === 'simple') result.sort((a,b) => a.items.length - b.items.length || a.recipe_number - b.recipe_number);
    else {
      const featured = [1,2,51,38,80,31,9,27,83]; // Stable recipe IDs survive display-name changes.
      const priority = r => {const i=featured.indexOf(r.recipe_id);return i < 0 ? 100 + r.recipe_number : i;};
      result.sort((a,b) => priority(a)-priority(b));
    }
    return result;
  }
  function recipeCard(r,index) {
    const saved = bookmarks.has(`r:${r.recipe_id}`);
    if (!isRecipeUnlocked(r.recipe_id)) {
      return `<article class="recipe-card is-locked" style="--card-color:#ece8dc;"><div class="compact-card-head"><span class="compact-recipe-icon" style="display:grid;place-items:center;width:28px;height:28px;border:1.5px solid var(--ink);background:#fffdf5;font-size:14px;">🔒</span><div class="compact-card-title"><span class="card-number">${esc(r.formatted_number)}</span><h3>${esc(name(r))}</h3></div><button class="bookmark ${saved?'is-saved':''}" data-bookmark="r:${r.recipe_id}" aria-label="${esc(name(r))} ${saved?'저장 취소':'저장'}" aria-pressed="${saved}">${uiIcon('bookmark',16)}</button></div><div class="inline-formula" style="justify-content:center; padding:8px; color:var(--muted); font-size:11px; font-weight:750; text-align:center;">🔒 ${syncedProgress.mode === 'tycoon' ? '타이쿤' : '퀴즈'} 모드 해금 시 공개</div><div class="compact-card-footer"><span class="compact-category">${esc(r.category)}</span></div></article>`;
    }
    return `<article class="recipe-card" data-recipe="${r.recipe_id}" style="--card-color:${colors[index%colors.length]};cursor:pointer;"><div class="compact-card-head"><span class="compact-recipe-icon">${icon(r,40)}</span><div class="compact-card-title"><span class="card-number">${esc(r.formatted_number)}</span><h3>${esc(name(r))}</h3></div><button class="bookmark ${saved?'is-saved':''}" data-bookmark="r:${r.recipe_id}" aria-label="${esc(name(r))} ${saved?'저장 취소':'저장'}" aria-pressed="${saved}">${uiIcon('bookmark',16)}</button></div><div class="inline-formula">${r.items.map((i,n)=>`<span class="formula-item">${r.requires_order?`<span class="ingredient-order">${n+1}</span>`:''}<span class="formula-image">${icon(ingredientFor(i),30)}<b>×${i.ratio}</b></span><span class="ingredient-name">${esc(name(ingredientFor(i)))}</span></span>`).join('<span class="formula-plus">+</span>')}</div><div class="compact-card-footer"><span class="compact-category">${esc(r.category)}</span>${r.requires_order?'<span class="order-badge">순서대로</span>':''}<button data-share-recipe="${r.recipe_id}" aria-label="${esc(name(r))} 공유">${uiIcon('share',15)}</button></div></article>`;
  }
  function voteControls(p){
    const target=p.suggestion_key?`s:${p.suggestion_key}`:`p:${p.id}`;
    return `<span class="vote-controls">${['UP','DOWN'].map(type=>`<button data-vote-target="${esc(target)}" data-vote-type="${type}" aria-label="${type==='UP'?'좋아요':'싫어요'}" aria-pressed="${p.myVote===type}">${uiIcon(type==='UP'?'up':'down',15)}<span>${type==='UP'?(p.upvotes||0):(p.downvotes||0)}</span></button>`).join('')}</span>`;
  }
  function suggestionCard(s,index){
    const badge = s.fromGame ? '🎮 게임 추천' : '조합 추천';
    return `<article class="suggestion-card" style="--card-color:${colors[index%colors.length]}"><div class="suggestion-badge">${badge}</div><div class="card-formula">${formula(s.items,true)}</div><div class="suggestion-actions">${voteControls(s)}<button data-copy-combo="${esc(s.suggestion_key)}" aria-label="조합 링크 공유">${uiIcon('share',16)}</button></div></article>`;
  }
  function boardMarkup(rows) {
    if (!rows.length) return '';
    return `<div class="community-board"><div class="board-head"><span>분류</span><span>제목</span><span>작성자</span><span>추천</span></div>${rows.map(p => `<article class="board-row"><span class="board-kind ${p.kind === 'experiment' ? 'is-exp' : ''}">${p.kind === 'experiment' ? '새 조합' : '플레이 팁'}</span><button class="board-title" data-comments="${esc(p.id)}">${esc(p.title)} <small>[${p.commentCount || 0}]${p.example ? ' · 예시' : ''}</small></button><span class="board-author">${esc(p.author)}</span>${p.example ? `<span class="board-votes">-</span>` : `<button type="button" class="board-votes ${(p.upvotes || 0) > 0 ? 'has-votes' : ''}" data-vote-target="p:${esc(p.id)}" data-vote-type="UP" aria-label="추천" aria-pressed="${p.myVote === 'UP'}" style="cursor:pointer;">👍 <span>${p.upvotes || 0}</span></button>`}</article>`).join('')}</div>`;
  }
  function postCard(p) {
    const avail = getAvailableIngredients();
    const hasLockedIngredient = p.kind === 'experiment' && Array.isArray(p.items) && !isItemsUnlocked(p.items, avail);
    const revealed = revealedSpoilers.has(p.id);
    const formulaHtml = p.kind === 'experiment'
      ? (hasLockedIngredient && !revealed
        ? `<div class="spoiler-shield"><span>🔒 미해금 재료가 포함된 실험 조합입니다.</span><button type="button" data-reveal-spoiler="${esc(p.id)}">스포일러 확인</button></div>`
        : `<div class="card-formula">${formula(p.items,true)}</div><p class="detail-note">실험 · 정답 미확인</p>`)
      : '';
    return `<article class="tip-card"><div class="tip-card-top"><span class="tip-kind">${p.kind === 'experiment' ? '새 조합 제안' : '플레이 팁'}</span><span>${p.example ? '예시' : p === sharedPost ? '공유' : p.isMine?'내 글':'공유 글'}</span></div><h3>${esc(p.title)}</h3><p>${renderBodyWithSafeHelpLinks(p.body)}</p>${formulaHtml}<div class="tip-footer"><span class="tip-author"><span class="tip-avatar">${esc(p.author.slice(0,1))}</span>${esc(p.author)}</span><div class="tip-card-actions">${p.example?'':`${voteControls(p)}${p.isMine ? `<button data-delete-post="${esc(p.id)}" aria-label="내 팁 삭제">${uiIcon('trash',17)}</button>` : ''}<button data-comments="${esc(p.id)}" aria-label="댓글">${uiIcon('comment',17)}<span>${p.commentCount||0}</span></button><button data-report="${esc(p.id)}" aria-label="글 신고">${uiIcon('flag',15)}</button>`}</div></div>${p.recipeId ? `<button class="text-link" data-recipe="${p.recipeId}">조합 ↗</button>` : ''}</article>`;
  }
  function applyPortalLangUi() {
    document.documentElement.lang = portalLang;
    const sel = $('#portal-lang-select');
    if (sel) sel.value = portalLang;
    $$('[data-nav]').forEach(b => {
      const k = b.dataset.nav;
      if (k !== 'saved' && PORTAL_UI[portalLang]?.[k]) b.textContent = pt(k);
    });
    const blogLink = $('.nav-blog-link');
    if (blogLink) blogLink.textContent = pt('blog');
    const h1 = $('.compact-banner h1');
    if (h1) h1.textContent = pt('heroTitle');
    const toolbarEl = $('.compact-toolbar');
    const showToolbar = !['rankings', 'updates', 'admin'].includes(activeTab);
    if (toolbarEl) toolbarEl.hidden = !showToolbar;
    const composeBtnEl = $('[data-compose]');
    const showCommunityActions = ['tips', 'suggestions'].includes(activeTab);
    if (composeBtnEl) {
      composeBtnEl.hidden = !showCommunityActions;
      if (showCommunityActions) {
        composeBtnEl.innerHTML = `${uiIcon('plus')} ${esc(activeTab === 'suggestions' ? '조합 제안' : pt('write'))}`;
      }
    }
    const searchEl = $('#search');
    if (searchEl) {
      searchEl.placeholder = activeTab === 'tips' ? '게시글 · 작성자 검색' : activeTab === 'suggestions' ? '재료로 추천 조합 검색' : pt('search');
    }
  }
  const UPDATE_LOGS = [
    { version: 'v2.4', date: '2026-11-14', title: { ko: '글로벌 다국어 & 문화 가이드 확장', en: 'Global Languages & Korean Drinking Game Guides', ja: '多言語対応＆飲み会ゲーム文化ガイド追加', 'zh-CN': '多语言支持与韩国酒桌游戏文化指南', 'zh-TW': '多語言支援與韓國酒桌遊戲文化指南' }, body: { ko: '영어·일본어·중국어(간체/번체) 지원, 미니게임 우측 상단 문화/도구 설명(i), 레시피별 스토리·제휴 링크 구조가 추가되었습니다.', en: 'Added English, Japanese, Simplified & Traditional Chinese support, top-right info guides for all 10 party mini-games, and recipe story/video links.' } },
    { version: 'v2.3', date: '2026-11-14', title: { ko: '조합 퀴즈 전용 문제 선택 팝업 개편', en: 'Dedicated Mix Quiz Stage Selector', ja: '調合クイズ専用のステージ選択ポップアップ', 'zh-CN': '调酒问答专属关卡选择弹窗', 'zh-TW': '調酒問答專屬關卡選擇彈窗' }, body: { ko: '84개 퀴즈 진행도 바, 도전 가능/완료 필터, 다음 미해결 원클릭 점프를 지원합니다.', en: 'Track your 84-recipe quiz progress with filter pills and one-tap jump to the next unsolved puzzle.' } },
    { version: 'v2.2', date: '2026-11-12', title: { ko: '친구 SOS 풀이 독립 페이지 출시', en: 'Friend SOS Standalone Solver', ja: 'フレンドSOS独立ページ公開', 'zh-CN': '好友求助独立解题页面上线', 'zh-TW': '好友求助獨立解題頁面上線' }, body: { ko: '링크만으로 친구의 막힌 술 조합 퀴즈를 도와줄 수 있는 초경량 SOS 풀이 화면이 추가되었습니다.', en: 'Share a compact link so friends can help solve tricky drink ratios without spoilers.' } }
  ];
  function rankingsMarkup() {
    const topPosts = [...posts].sort((a,b) => ((b.upvotes||0)-(b.downvotes||0)) - ((a.upvotes||0)-(a.downvotes||0))).slice(0, 6);
    const rankList = tycoonRankings[activeRankMode] || [];
    const findName = (rankSearchQuery || getDefaultNickname() || '').trim().toLowerCase();
    const myRankIndex = findName ? rankList.findIndex(r => String(r.player_name || '').toLowerCase().includes(findName)) : -1;
    const myRankRow = myRankIndex >= 0 ? rankList[myRankIndex] : null;
    return `
      <div class="rankings-board">
        <section class="neo-panel">
          <div class="neo-panel-head">
            <h3>🏆 주점 타이쿤 글로벌 Top 100 <small style="font-size:11px;font-weight:700;color:var(--muted);">(게임 내 Top 10 · 사이트 전체 100위 조회)</small></h3>
            <div class="rank-mode-tabs">
              <button type="button" data-rank-mode="TIME_ATTACK" class="${activeRankMode==='TIME_ATTACK'?'is-active':''}">⏱️ 타임어택</button>
              <button type="button" data-rank-mode="INFINITE" class="${activeRankMode==='INFINITE'?'is-active':''}">♾️ 무한모드</button>
            </div>
          </div>
          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:12px;">
            <input id="rank-my-search" type="search" value="${esc(rankSearchQuery)}" placeholder="내 주모 닉네임으로 순위 찾기 (예: 미니빅)" style="flex:1;min-width:200px;padding:7px 10px;border:2px solid var(--ink);font-size:12px;background:#fff;">
            ${myRankRow ? `<div style="padding:6px 12px;border:2px solid var(--ink);background:var(--green);font-size:12px;font-weight:850;">🎯 내 순위: <b>#${myRankIndex + 1}위</b> · ${esc(myRankRow.player_name)} (${myRankRow.served_count}잔 / ${Number(myRankRow.total_earnings || 0).toLocaleString()}냥)</div>` : (findName ? `<span style="font-size:11px;color:var(--muted);">'${esc(findName)}' 기록이 Top 100 내에 없습니다.</span>` : '')}
          </div>
          ${rankList.length ? `
            <div class="rank-table-wrap" style="max-height:460px;overflow-y:auto;">
              <table class="rank-table">
                <thead><tr><th>순위</th><th>주모</th><th>서빙</th><th>매출</th><th>최대 콤보</th><th>웨이브</th></tr></thead>
                <tbody>
                  ${rankList.slice(0, 100).map((row, idx) => {
                    const isMine = findName && String(row.player_name || '').toLowerCase().includes(findName);
                    return `
                    <tr class="${isMine ? 'is-mine-rank' : idx < 3 ? 'is-top3' : ''}" style="${isMine ? 'background:#d5f88a;font-weight:900;' : ''}">
                      <td><span class="rank-badge-num">${idx + 1}</span></td>
                      <td>${esc(row.badge_emoji || '🍶')} <strong>${esc(row.player_name || '익명주모')}</strong>${isMine ? ' <span style="font-size:10px;border:1px solid var(--ink);background:#fff;padding:1px 4px;">ME</span>' : ''}</td>
                      <td>${Number(row.served_count || 0)}잔</td>
                      <td>${Number(row.total_earnings || 0).toLocaleString()}냥</td>
                      <td>${Number(row.max_combo || 0)}콤보</td>
                      <td>W${Number(row.max_wave || 1)}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>
          ` : '<p style="margin:0;color:var(--muted);font-size:12px;">랭킹 데이터를 불러오는 중이거나 아직 등록된 기록이 없습니다.</p>'}
        </section>
        ${topPosts.length ? `<section class="neo-panel"><div class="neo-panel-head"><h3>💬 인기 커뮤니티 팁</h3></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">${topPosts.map(postCard).join('')}</div></section>` : ''}
      </div>
    `;
  }
  function updatesMarkup() {
    const customList = dbUpdates.map(u => `<article class="neo-panel"><div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;"><span style="background:var(--coral); color:var(--ink); border:1.5px solid var(--ink); padding:2px 8px; font-size:11px; font-weight:800;">${esc(u.version)}</span><small style="color:var(--muted);">${esc(u.date)}</small></div><h4 style="margin:0 0 6px; font-size:15px; font-weight:850;">${esc(u.title)}</h4><p style="margin:0; font-size:12px; line-height:1.6; white-space:pre-wrap;">${esc(u.body)}</p></article>`).join('');
    return `
      <div class="updates-board" style="grid-column:1/-1; display:flex; flex-direction:column; gap:14px;">
        <div class="neo-panel" style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
          <div>
            <h3 style="margin:0 0 4px; font-size:16px; font-weight:900;">${esc(pt('updateTitle'))}</h3>
            <p style="margin:0; font-size:12px; color:var(--muted);">K-Sool Official Blog &amp; Video Guides</p>
          </div>
          <a href="https://ksool.blogspot.com/" target="_blank" rel="noopener noreferrer" class="button coral" style="text-decoration:none;">📖 ksool.blogspot.com ↗</a>
        </div>
        ${customList}
        ${UPDATE_LOGS.map(u => {
          const title = u.title[portalLang] || u.title.en || u.title.ko;
          const body = u.body[portalLang] || u.body.en || u.body.ko;
          return `<article class="neo-panel"><div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;"><span style="background:var(--ink); color:#fff; padding:2px 8px; font-size:11px; font-weight:800;">${esc(u.version)}</span><small style="color:var(--muted);">${esc(u.date)}</small></div><h4 style="margin:0 0 6px; font-size:15px; font-weight:850;">${esc(title)}</h4><p style="margin:0; font-size:12px; line-height:1.6;">${esc(body)}</p></article>`;
        }).join('')}
      </div>
    `;
  }
  function adminMarkup() {
    if (!isAdminUser) {
      return `<div class="neo-panel" style="grid-column:1/-1;"><h3>⚙️ 관리자 전용 페이지</h3><p style="font-size:12px;color:var(--muted);">관리자 권한이 부여된 Google 계정으로 로그인하면 커뮤니티·추천 조합·공지를 관리할 수 있습니다.</p></div>`;
    }
    const subTabs = [
      canAdmin('posts') ? { id: 'reports', label: `🚨 신고/글 (${adminData.reports.length})` } : null,
      canAdmin('suggestions') ? { id: 'suggestions', label: `🧪 추천 조합 (${adminData.gameSuggestions.length + adminData.suggestions.length})` } : null,
      canAdmin('updates') ? { id: 'updates', label: `📢 공지 관리 (${adminData.updates.length})` } : null,
      isSuperAdmin ? { id: 'roles', label: `👥 운영자 권한 (${adminData.roles.length})` } : null
    ].filter(Boolean);
    let bodyHtml = '';
    if (activeAdminTab === 'reports' && canAdmin('posts')) {
      bodyHtml = `
        <section class="neo-panel">
          <div class="neo-panel-head"><h3>🚨 신고 접수된 글</h3></div>
          <div class="admin-list">
            ${adminData.reports.length ? adminData.reports.map(r => `
              <div class="admin-row">
                <div class="admin-row-main">
                  <strong>[${esc(r.report_count)}건] ${esc(r.title)} <small>(${esc(r.author)})</small></strong>
                  <p>사유: ${esc(r.reasons)} · 내용: ${esc(String(r.body).slice(0, 90))}</p>
                </div>
                <div class="admin-row-actions">
                  <button type="button" class="admin-btn" data-admin-dismiss-report="${esc(r.post_id)}">무혐의</button>
                  <button type="button" class="admin-btn is-danger" data-admin-delete-post="${esc(r.post_id)}">글 삭제</button>
                </div>
              </div>
            `).join('') : '<p style="margin:0;font-size:12px;color:var(--muted);">신고된 글이 없습니다.</p>'}
          </div>
        </section>
        <section class="neo-panel">
          <div class="neo-panel-head"><h3>💬 최근 커뮤니티 게시글 (${adminData.posts.length})</h3></div>
          <div class="admin-list">
            ${adminData.posts.map(p => `
              <div class="admin-row">
                <div class="admin-row-main">
                  <strong>${esc(p.title)} <small>by ${esc(p.author)} · 댓글 ${p.commentCount || 0}</small></strong>
                  <p>${esc(String(p.body).slice(0, 100))}</p>
                </div>
                <div class="admin-row-actions">
                  <button type="button" class="admin-btn" data-comments="${esc(p.id)}">댓글 보기</button>
                  <button type="button" class="admin-btn is-danger" data-admin-delete-post="${esc(p.id)}">삭제</button>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      `;
    } else if (activeAdminTab === 'suggestions' && canAdmin('suggestions')) {
      bodyHtml = `
        <section class="neo-panel">
          <div class="neo-panel-head"><h3>🎮 게임 내 추천 조합 (Supabase ksool_suggestions)</h3></div>
          <div class="admin-list">
            ${adminData.gameSuggestions.length ? adminData.gameSuggestions.map(s => `
              <div class="admin-row">
                <div class="admin-row-main">
                  <strong>${formula(s.items || [], false)}</strong>
                  <small>👍 ${s.upvotes || 0} / 👎 ${s.downvotes || 0} · 상태: ${s.is_applied ? '✅ 도감 반영됨' : '대기 중'}</small>
                </div>
                <div class="admin-row-actions">
                  ${canAdmin('prompt_gen') ? `<button type="button" class="admin-btn" data-admin-prompt-items='${esc(JSON.stringify(s.items || []))}'>🤖 Agent 프롬프트</button>` : ''}
                  <button type="button" class="admin-btn ${s.is_applied ? '' : 'is-ok'}" data-admin-gsug-apply="${esc(s.suggestion_key)}" data-applied="${s.is_applied ? '1' : '0'}">${s.is_applied ? '반영 해제' : '⚡ 도감 반영'}</button>
                  <button type="button" class="admin-btn is-danger" data-admin-gsug-delete="${esc(s.suggestion_key)}">삭제</button>
                </div>
              </div>
            `).join('') : '<p style="margin:0;font-size:12px;color:var(--muted);">게임 내 추천 조합이 없습니다.</p>'}
          </div>
        </section>
        <section class="neo-panel">
          <div class="neo-panel-head"><h3>💬 커뮤니티 추천 조합</h3></div>
          <div class="admin-list">
            ${adminData.suggestions.length ? adminData.suggestions.map(s => `
              <div class="admin-row">
                <div class="admin-row-main">
                  <strong>${formula(s.items || [], false)}</strong>
                  <small>👍 ${s.upvotes || 0} / 👎 ${s.downvotes || 0} · 상태: ${s.is_applied ? '✅ 적용됨' : '노출 중'}</small>
                </div>
                <div class="admin-row-actions">
                  ${canAdmin('prompt_gen') ? `<button type="button" class="admin-btn" data-admin-prompt-items='${esc(JSON.stringify(s.items || []))}'>🤖 Agent 프롬프트</button>` : ''}
                  <button type="button" class="admin-btn ${s.is_applied ? '' : 'is-ok'}" data-admin-csug-apply="${esc(s.suggestion_key)}" data-applied="${s.is_applied ? '1' : '0'}">${s.is_applied ? '적용 해제' : '적용 완료'}</button>
                  <button type="button" class="admin-btn is-danger" data-admin-csug-delete="${esc(s.suggestion_key)}">삭제</button>
                </div>
              </div>
            `).join('') : '<p style="margin:0;font-size:12px;color:var(--muted);">커뮤니티 추천 조합이 없습니다.</p>'}
          </div>
        </section>
      `;
    } else if (activeAdminTab === 'updates' && canAdmin('updates')) {
      bodyHtml = `
        <section class="neo-panel">
          <div class="neo-panel-head"><h3>📢 업데이트 공지 작성</h3></div>
          <form id="admin-update-form" class="admin-update-form">
            <div class="admin-update-row">
              <input name="version" placeholder="v2.5" maxlength="20" required>
              <input name="date" value="${new Date().toISOString().slice(0, 10)}" maxlength="20" required>
              <input name="title" placeholder="공지 제목" maxlength="100" required>
            </div>
            <textarea name="body" rows="3" placeholder="공지 내용을 입력하세요" maxlength="1500" required></textarea>
            <button type="submit" class="button coral" style="justify-self:start;min-height:36px;">공지 등록</button>
          </form>
          <div class="admin-list">
            ${adminData.updates.length ? adminData.updates.map(u => `
              <div class="admin-row">
                <div class="admin-row-main">
                  <strong>[${esc(u.version)}] ${esc(u.title)} <small>${esc(u.date)}</small></strong>
                  <p>${esc(u.body)}</p>
                </div>
                <div class="admin-row-actions">
                  <button type="button" class="admin-btn is-danger" data-admin-delete-update="${esc(u.id)}">삭제</button>
                </div>
              </div>
            `).join('') : '<p style="margin:0;font-size:12px;color:var(--muted);">등록된 공지가 없습니다.</p>'}
          </div>
        </section>
      `;
    } else if (activeAdminTab === 'roles' && isSuperAdmin) {
      bodyHtml = `
        <section class="neo-panel">
          <div class="neo-panel-head"><h3>👥 부분 권한 운영자 지정 (최고 관리자 전용)</h3></div>
          <p style="margin:0 0 10px;font-size:12px;color:var(--muted);">최고 관리자 권한은 Cloud Run 비밀 환경변수(<code>ADMIN_EMAILS</code>)로만 제어되며, 아래에서 다른 Google 계정에 필요한 일부 관리 권한만 위임할 수 있습니다.</p>
          <form id="admin-role-form" class="admin-update-form">
            <input name="email" type="email" placeholder="권한을 부여할 Google 이메일 (예: helper@gmail.com)" required>
            <div style="display:flex;gap:12px;flex-wrap:wrap;font-size:12px;font-weight:700;">
              <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" name="perm" value="posts" checked> 🚨 신고/글/댓글 관리</label>
              <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" name="perm" value="suggestions"> 🧪 추천 조합 관리</label>
              <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" name="perm" value="prompt_gen"> 🤖 Agent 프롬프트 생성</label>
              <label style="display:flex;align-items:center;gap:5px;"><input type="checkbox" name="perm" value="updates"> 📢 공지 작성</label>
            </div>
            <button type="submit" class="button coral" style="justify-self:start;min-height:36px;">운영자 권한 저장</button>
          </form>
          <div class="admin-list">
            ${adminData.roles.length ? adminData.roles.map(r => `
              <div class="admin-row">
                <div class="admin-row-main">
                  <strong>${esc(r.email)}</strong>
                  <small>부여된 권한: ${esc((r.permissions || []).join(', '))}</small>
                </div>
                <div class="admin-row-actions">
                  <button type="button" class="admin-btn is-danger" data-admin-delete-role="${esc(r.email)}">권한 회수</button>
                </div>
              </div>
            `).join('') : '<p style="margin:0;font-size:12px;color:var(--muted);">등록된 부분 권한 운영자가 없습니다.</p>'}
          </div>
        </section>
      `;
    }
    return `
      <div class="admin-board">
        <div class="admin-subtabs">
          ${subTabs.map(t => `<button type="button" data-admin-subtab="${t.id}" class="${activeAdminTab===t.id?'is-active':''}">${t.label}</button>`).join('')}
          <button type="button" id="admin-refresh-btn" class="admin-btn" style="margin-left:auto;">↻ 새로고침</button>
        </div>
        ${bodyHtml}
      </div>
    `;
  }
  function bindAdminActions(root) {
    $$('[data-admin-subtab]', root).forEach(b => b.onclick = () => { activeAdminTab = b.dataset.adminSubtab; render(); });
    const refreshBtn = $('#admin-refresh-btn', root);
    if (refreshBtn) refreshBtn.onclick = () => loadAdminData();
    $$('[data-admin-dismiss-report]', root).forEach(b => b.onclick = async () => {
      try { await adminApi(`/admin/reports/${encodeURIComponent(b.dataset.adminDismissReport)}/dismiss`, { method: 'POST' }); toast('신고 해제 완료'); await loadAdminData(); } catch (e) { toast(e.message); }
    });
    $$('[data-admin-delete-post]', root).forEach(b => b.onclick = async () => {
      try { await adminApi(`/admin/posts/${encodeURIComponent(b.dataset.adminDeletePost)}`, { method: 'DELETE' }); toast('게시글 삭제 완료'); await syncCommunity(); await loadAdminData(); } catch (e) { toast(e.message); }
    });
    $$('[data-admin-csug-apply]', root).forEach(b => b.onclick = async () => {
      try { await adminApi(`/admin/suggestions/${encodeURIComponent(b.dataset.adminCsugApply)}`, { method: 'PATCH', body: JSON.stringify({ is_applied: b.dataset.applied !== '1' }) }); toast('상태 변경 완료'); await syncCommunity(); await loadAdminData(); } catch (e) { toast(e.message); }
    });
    $$('[data-admin-csug-delete]', root).forEach(b => b.onclick = async () => {
      try { await adminApi(`/admin/suggestions/${encodeURIComponent(b.dataset.adminCsugDelete)}`, { method: 'DELETE' }); toast('추천 조합 삭제 완료'); await syncCommunity(); await loadAdminData(); } catch (e) { toast(e.message); }
    });
    $$('[data-admin-prompt-items]', root).forEach(b => b.onclick = async () => {
      b.disabled = true;
      const orig = b.textContent;
      b.textContent = '생성 중...';
      try {
        const items = JSON.parse(b.dataset.adminPromptItems || '[]');
        const res = await adminApi('/admin/generate-recipe-prompt', { method: 'POST', body: JSON.stringify({ items }) });
        $('#recipe-detail').innerHTML = `
          <h2 style="font-size:20px;margin:6px 0 10px;">🤖 개발 Agent 도감 편입 프롬프트 <small style="font-size:11px;color:var(--muted);">(${res.mode === 'gemini' ? 'Google Gemini AI 생성' : '구조화 템플릿 생성'})</small></h2>
          <p style="font-size:12px;color:var(--muted);margin:0 0 10px;">아래 프롬프트를 복사해 개발 Agent에게 전달하면 <code>data/recipes.json</code>, <code>ProgressionEngine.js</code>, 아이콘 SVG, 다국어 파일까지 한 번에 반영됩니다.</p>
          <textarea id="generated-agent-prompt" rows="16" style="width:100%;font-family:ui-monospace,Consolas,monospace;font-size:11px;padding:10px;border:2px solid var(--ink);background:#fffdf5;">${esc(res.prompt)}</textarea>
          <div class="detail-actions">
            <button type="button" id="copy-agent-prompt-btn" class="button coral" style="width:100%;justify-content:center;">📋 프롬프트 복사하기</button>
          </div>
        `;
        $('#copy-agent-prompt-btn').onclick = () => shareLink(res.prompt, 'Agent 프롬프트');
        openDialog($('#recipe-dialog'));
      } catch (e) { toast(e.message); }
      finally { b.disabled = false; b.textContent = orig; }
    });
    $$('[data-admin-gsug-apply]', root).forEach(b => b.onclick = async () => {
      if (!sbClient) return;
      const { error } = await sbClient.from('ksool_suggestions').update({ is_applied: b.dataset.applied !== '1' }).eq('suggestion_key', b.dataset.adminGsugApply);
      if (error) { toast(error.message); return; }
      toast('게임 추천 조합 상태 변경 완료'); await loadRemoteGameData(); await loadAdminData();
    });
    $$('[data-admin-gsug-delete]', root).forEach(b => b.onclick = async () => {
      if (!sbClient) return;
      const { error } = await sbClient.from('ksool_suggestions').delete().eq('suggestion_key', b.dataset.adminGsugDelete);
      if (error) { toast(error.message); return; }
      toast('게임 추천 조합 삭제 완료'); await loadRemoteGameData(); await loadAdminData();
    });
    $$('[data-admin-delete-update]', root).forEach(b => b.onclick = async () => {
      try { await adminApi(`/admin/updates/${encodeURIComponent(b.dataset.adminDeleteUpdate)}`, { method: 'DELETE' }); toast('공지 삭제 완료'); await loadRemoteGameData(); await loadAdminData(); } catch (e) { toast(e.message); }
    });
    const updForm = $('#admin-update-form', root);
    if (updForm) {
      updForm.onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(updForm);
        try {
          await adminApi('/admin/updates', { method: 'POST', body: JSON.stringify({ version: f.get('version').trim(), date: f.get('date').trim(), title: f.get('title').trim(), body: f.get('body').trim() }) });
          toast('공지 등록 완료'); await loadRemoteGameData(); await loadAdminData();
        } catch (err) { toast(err.message); }
      };
    }
    const roleForm = $('#admin-role-form', root);
    if (roleForm) {
      roleForm.onsubmit = async e => {
        e.preventDefault();
        const f = new FormData(roleForm);
        const permissions = f.getAll('perm');
        try {
          await adminApi('/admin/roles', { method: 'POST', body: JSON.stringify({ email: f.get('email').trim(), permissions }) });
          toast('운영자 권한 저장 완료'); await loadAdminData();
        } catch (err) { toast(err.message); }
      };
    }
    $$('[data-admin-delete-role]', root).forEach(b => b.onclick = async () => {
      try { await adminApi(`/admin/roles/${encodeURIComponent(b.dataset.adminDeleteRole)}`, { method: 'DELETE' }); toast('권한 회수 완료'); await loadAdminData(); } catch (e) { toast(e.message); }
    });
  }
  function renderHeaderAuthButton() {
    const btn = $('#header-auth-btn');
    if (!btn) return;
    if (!sbClient) { btn.hidden = true; return; }
    btn.hidden = false;
    if (sbUser) {
      btn.classList.add('is-signed-in');
      btn.textContent = `☁️ ${(sbUser.user_metadata?.full_name || sbUser.email?.split('@')[0] || 'Google').slice(0, 10)}`;
      btn.onclick = () => { syncFromSupabaseUser(); toast('Google 계정과 진행도를 다시 동기화했어요.'); };
    } else {
      btn.classList.remove('is-signed-in');
      btn.textContent = 'G Google 연동';
      btn.onclick = async () => {
        const { error } = await sbClient.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: getSafeOAuthRedirectUrl() } });
        if (error) toast(`Google 연동 오류: ${error.message}`);
      };
    }
  }
  function progressSyncMarkup() {
    const isQuiz = syncedProgress.mode !== 'tycoon';
    const total = Math.max(1, recipes.length);
    const quizCount = syncedProgress.quiz.length;
    const tycoonCount = syncedProgress.tycoon.length;
    const quizPct = Math.round((quizCount / total) * 100);
    const tycoonPct = Math.round((tycoonCount / total) * 100);
    return `
      <div id="progress-sync-bar" class="progress-sync-bar">
        <div class="sync-cards-row">
          <div class="sync-cards-grid">
            <button type="button" data-progress-mode="quiz" class="sync-stat-card ${isQuiz ? 'is-active' : ''}" aria-pressed="${isQuiz}">
              <div class="sync-stat-head">
                <span class="sync-stat-title">🎯 퀴즈 도감</span>
                <span class="sync-stat-count"><b>${quizCount}</b>/${total} <em>(${quizPct}%)</em></span>
              </div>
              <span class="sync-stat-meter" aria-hidden="true"><span class="sync-stat-fill" style="width:${quizPct}%"></span></span>
            </button>
            <button type="button" data-progress-mode="tycoon" class="sync-stat-card ${!isQuiz ? 'is-active' : ''}" aria-pressed="${!isQuiz}">
              <div class="sync-stat-head">
                <span class="sync-stat-title">🏪 타이쿤 도감</span>
                <span class="sync-stat-count"><b>${tycoonCount}</b>/${total} <em>(${tycoonPct}%)</em></span>
              </div>
              <span class="sync-stat-meter" aria-hidden="true"><span class="sync-stat-fill" style="width:${tycoonPct}%"></span></span>
            </button>
          </div>
          ${!sbUser ? `<button type="button" id="toggle-manual-code-btn" class="sync-code-link" aria-expanded="${showManualCodeInput}">${showManualCodeInput ? '닫기' : '코드 입력'}</button>` : ''}
        </div>
        ${(!sbUser && showManualCodeInput) ? `
          <div class="sync-manual-form">
            <input id="community-sync-input" type="text" placeholder="게임(⚙️ 설정 → 진행도 내보내기)의 공유 링크 또는 KSOOL_SYNC_V1 코드">
            <button type="button" id="community-sync-import-btn" class="button coral" style="min-height:32px;padding:5px 12px;">가져오기</button>
          </div>
        ` : ''}
      </div>
    `;
  }
  function bindProgressSyncBar(root) {
    const bar = $('#progress-sync-bar', root);
    if (!bar) return;
    $$('[data-progress-mode]', bar).forEach(b => b.onclick = () => {
      followGameMode = false;
      syncedProgress.mode = b.dataset.progressMode === 'tycoon' ? 'tycoon' : 'quiz';
      saveSyncedProgress();
      render();
    });
    const toggleCodeBtn = $('#toggle-manual-code-btn', bar);
    if (toggleCodeBtn) toggleCodeBtn.onclick = () => { showManualCodeInput = !showManualCodeInput; render(); };
    const importBtn = $('#community-sync-import-btn', bar);
    const importInput = $('#community-sync-input', bar);
    if (importBtn && importInput) {
      importBtn.onclick = () => {
        const parsed = decodeSyncInput(importInput.value);
        if (!parsed) { toast('올바른 공유 링크 또는 KSOOL_SYNC_V1 코드를 입력해 주세요.'); return; }
        progressEpoch++;
        syncedProgress.tycoon = parsed.tycoon;
        syncedProgress.quiz = parsed.quiz;
        syncedProgress.tycoonIngredients = parsed.tycoonIngredients || [];
        syncedProgress.quizIngredients = parsed.quizIngredients || [];
        if (!parsed.quiz.length && parsed.tycoon.length) syncedProgress.mode = 'tycoon';
        showManualCodeInput = false;
        saveSyncedProgress();
        toast(`✅ 내 기록을 가져왔습니다! (퀴즈 ${parsed.quiz.length}개 · 타이쿤 ${parsed.tycoon.length}개)`);
        render();
      };
    }
  }
  function lockedCompactRow(r) {
    return `<div class="locked-compact-row"><span class="locked-compact-num">${esc(r.formatted_number)}</span><span class="locked-compact-name">🔒 ${esc(name(r))}</span></div>`;
  }
  function renderGroupedRecipes(matches) {
    const unlocked = matches.filter(r => isRecipeUnlocked(r.recipe_id));
    const locked = matches.filter(r => !isRecipeUnlocked(r.recipe_id));
    let html = '';
    html += `<section class="recipe-section-clean">
      <div class="recipe-section-head"><h3>🔓 해금한 조합</h3><span class="recipe-section-count">${unlocked.length}</span></div>
      ${unlocked.length
        ? `<div class="recipe-section-grid">${unlocked.map((r, i) => recipeCard(r, i)).join('')}</div>`
        : `<p style="margin:8px 0 0;font-size:12px;color:var(--muted);">아직 해금된 조합이 없습니다. 게임에서 조합에 성공하거나 상단 <b>Google 연동</b>을 눌러 진행도를 불러오세요.</p>`}
    </section>`;
    if (locked.length) {
      const openByDefault = unlocked.length === 0 || Boolean(query.trim());
      const isOpen = isSectionOpen('locked', openByDefault);
      html += `<details class="stage-accordion" data-section-id="locked" ${isOpen ? 'open' : ''}>
        <summary><span class="stage-code">LOCKED</span><span class="stage-title">🔒 아직 해금하지 않은 조합</span><span class="stage-progress">${locked.length}개</span></summary>
        <div class="stage-body"><div class="locked-compact-grid">${locked.map(lockedCompactRow).join('')}</div></div>
      </details>`;
    }
    return html;
  }
  function getMaxUnlockedStep() {
    let maxStep = 1;
    const byStep = new Map();
    for (const r of data.recipes) {
      const s = Math.min(6, Math.max(1, Number(r.step_id) || 1));
      if (!byStep.has(s)) byStep.set(s, []);
      byStep.get(s).push(r);
      if (isRecipeUnlocked(r.recipe_id) && s > maxStep) maxStep = s;
    }
    for (let s = 1; s < 6; s++) {
      const stepList = byStep.get(s) || [];
      if (stepList.length && stepList.every(r => isRecipeUnlocked(r.recipe_id))) {
        maxStep = Math.max(maxStep, s + 1);
      }
    }
    return maxStep;
  }
  function renderStageRecipes(matches) {
    const maxUnlockedStep = getMaxUnlockedStep();
    const groups = new Map();
    for (let s = 1; s <= 6; s++) groups.set(s, []);
    for (const r of matches) {
      const step = Math.min(6, Math.max(1, Number(r.step_id) || 1));
      groups.get(step).push(r);
    }
    const sections = [];
    let hiddenStageCount = 0;
    for (const [step, list] of groups.entries()) {
      if (!list.length) continue;
      if (step > maxUnlockedStep) {
        hiddenStageCount += 1;
        continue;
      }
      const meta = STAGE_META[step] || { code: `STAGE ${step}`, title: `단계 ${step}` };
      const unlocked = list.filter(r => isRecipeUnlocked(r.recipe_id));
      const locked = list.filter(r => !isRecipeUnlocked(r.recipe_id));
      const defaultOpen = Boolean(query.trim()) || (unlocked.length > 0 && unlocked.length < list.length) || (step === 1 && unlocked.length === 0);
      const isOpen = isSectionOpen(`stage-${step}`, defaultOpen);
      sections.push(`
        <details class="stage-accordion" data-section-id="stage-${step}" ${isOpen ? 'open' : ''}>
          <summary>
            <span class="stage-code">${esc(meta.code)}</span>
            <span class="stage-title">${esc(meta.title)}</span>
            <span class="stage-progress">${unlocked.length} / ${list.length}</span>
          </summary>
          <div class="stage-body">
            ${unlocked.length ? `<div class="recipe-section-grid">${unlocked.map((r, i) => recipeCard(r, i)).join('')}</div>` : ''}
            ${locked.length ? `<div class="locked-compact-grid">${locked.map(lockedCompactRow).join('')}</div>` : ''}
          </div>
        </details>
      `);
    }
    if (hiddenStageCount > 0) {
      sections.push(`<div class="stage-locked-notice" style="padding:12px 14px;border:2px dashed var(--ink);background:var(--paper-soft);font-size:12px;font-weight:700;color:var(--muted);">🔒 아직 해금하지 않은 상위 스테이지 ${hiddenStageCount}개는 스포일러 방지를 위해 숨겨져 있습니다. 게임에서 해금 후 동기화하면 공개됩니다.</div>`);
    }
    return sections.join('');
  }
  function searchToolbarMarkup(placeholder, withActions = false, composeLabel = pt('write')) {
    return `
      <div class="compact-toolbar">
        <div class="search-row"><label class="search-box">${uiIcon('search',18)}<span class="visually-hidden">${esc(placeholder)}</span><input id="search" type="search" value="${esc(query)}" placeholder="${esc(placeholder)}" autocomplete="off"></label></div>
        ${withActions ? `<button class="button coral" data-compose aria-label="${esc(composeLabel)}">${uiIcon('plus')} ${esc(composeLabel)}</button>` : ''}
      </div>
    `;
  }
  function bindToolbarEvents(root, onSearchInput) {
    const searchEl = $('#search', root);
    if (searchEl) {
      searchEl.oninput = e => { query = e.target.value; limit = 16; onSearchInput(); };
    }
    $$('[data-compose]', root).forEach(b => b.onclick = () => openCompose(null, activeTab === 'suggestions' ? 'experiment' : 'tip'));
  }
  function renderCatalogGridOnly(root) {
    const grid = $('#recipe-grid', root);
    if (!grid) return;
    const matches = filterRecipes();
    const postsMatches = activeTab === 'saved'
      ? allPosts().filter(p => bookmarks.has(`t:${p.id}`) && `${p.title} ${p.body} ${p.author}`.toLowerCase().includes(query.toLowerCase()))
      : [];
    const savedHtml = [
      matches.length ? `<section class="recipe-section-clean"><div class="recipe-section-head"><h3>🔖 저장한 조합</h3><span class="recipe-section-count">${matches.length}</span></div><div class="recipe-section-grid">${matches.map((r, i) => recipeCard(r, i)).join('')}</div></section>` : '',
      postsMatches.length ? `<section class="recipe-section-clean" style="margin-top:16px;"><div class="recipe-section-head"><h3>💬 저장한 글</h3><span class="recipe-section-count">${postsMatches.length}</span></div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">${postsMatches.map(postCard).join('')}</div></section>` : ''
    ].filter(Boolean).join('');
    const markup = activeTab === 'recipes'
      ? (matches.length ? (activeViewMode === 'stage' ? renderStageRecipes(matches) : renderGroupedRecipes(matches)) : '')
      : savedHtml;
    grid.innerHTML = markup || `<div class="empty-state"><span>✧</span><h3>${activeTab==='saved' ? '다시 보고 싶은 발견을 모아두세요' : '아직 일치하는 발견이 없어요'}</h3><p>${activeTab==='saved' ? '공략 카드의 책갈피 버튼을 눌러 저장할 수 있어요.' : '다른 검색어나 필터로 찾아보세요.'}</p></div>`;
    bindCardActions(grid);
    $$('details[data-section-id]', grid).forEach(d => {
      d.addEventListener('toggle', () => sectionOpenState.set(d.dataset.sectionId, d.open));
    });
  }
  function renderCommunityGridOnly(root) {
    const grid = $('#recipe-grid', root);
    if (!grid) return;
    const matchingPosts = allPosts().filter(p => (activeCategory === '전체' || (activeCategory === '플레이 팁' ? p.kind === 'tip' : p.kind === 'experiment')) && `${p.title} ${p.body} ${p.author}`.toLowerCase().includes(query.toLowerCase()));
    grid.innerHTML = boardMarkup(matchingPosts) || `<div class="empty-state"><span>✧</span><h3>아직 일치하는 글이 없어요</h3><p>다른 검색어나 분류로 찾아보세요.</p></div>`;
    bindCardActions(grid);
  }
  function renderSuggestionsGridOnly(root) {
    const grid = $('#recipe-grid', root);
    if (!grid) return;
    const avail = getAvailableIngredients();
    const allMergedSug = mergedSuggestions();
    const safeSug = allMergedSug.filter(s => isItemsUnlocked(s.items, avail));
    const hiddenSugCount = allMergedSug.length - safeSug.length;
    const matchingSuggestions = safeSug.filter(s => s.items.map(i => name(ingredientFor(i))).join(' ').toLowerCase().includes(query.toLowerCase()));
    const spoilerBanner = hiddenSugCount > 0
      ? `<div class="spoiler-shield" style="grid-column:1/-1;"><span>🔒 아직 해금하지 않은 재료가 포함된 추천 조합 <b>${hiddenSugCount}개</b>는 스포일러 방지를 위해 숨겨져 있습니다.</span><a href="https://play.ksool.minibig.pw/" target="_blank" rel="noopener noreferrer" style="font-weight:850;color:var(--ink);">게임에서 재료 해금하기 ↗</a></div>`
      : '';
    grid.innerHTML = spoilerBanner + (matchingSuggestions.map(suggestionCard).join('') || `<div class="empty-state"><span>✧</span><h3>일치하는 추천 조합이 없어요</h3><p>다른 재료로 검색하거나 새 조합을 제안해보세요.</p></div>`);
    bindCardActions(grid);
  }
  function render() {
    applyPortalLangUi();
    renderHeaderAuthButton();
    $$('[data-tab]').forEach(b => b.classList.toggle('selected', b.dataset.tab === activeTab));
    $$('[data-nav]').forEach(b => b.classList.toggle('nav-active', b.dataset.nav === activeTab));
    $('#saved-count').textContent = bookmarks.size;
    if ($('#tip-count')) $('#tip-count').textContent = allPosts().length;
    if (!$('#post-recipe').dataset.ready) {
      $('#post-recipe').innerHTML = '<option value="">선택하지 않음</option>' + recipes.map(r => `<option value="${r.recipe_id}">${esc(r.formatted_number)} · ${esc(name(r))}</option>`).join('');
      $('#post-recipe').dataset.ready = '1';
    }
    const root = $('#view-root');
    if (!root) return;

    if (activeTab === 'admin') {
      root.innerHTML = `<div id="recipe-grid" class="recipe-grid">${adminMarkup()}</div>`;
      bindAdminActions(root);
      bindCardActions(root);
      return;
    }
    if (activeTab === 'rankings') {
      root.innerHTML = `<div id="recipe-grid" class="recipe-grid">${rankingsMarkup()}</div>`;
      $$('[data-rank-mode]', root).forEach(b => b.onclick = () => { activeRankMode = b.dataset.rankMode; render(); });
      const rankSearchEl = $('#rank-my-search', root);
      if (rankSearchEl) {
        rankSearchEl.oninput = e => {
          rankSearchQuery = e.target.value;
          const pos = e.target.selectionStart;
          render();
          const nextEl = $('#rank-my-search');
          if (nextEl) { nextEl.focus(); try { nextEl.setSelectionRange(pos, pos); } catch (_) {} }
        };
      }
      bindCardActions(root);
      return;
    }
    if (activeTab === 'updates') {
      root.innerHTML = `<div id="recipe-grid" class="recipe-grid">${updatesMarkup()}</div>`;
      return;
    }
    if (activeTab === 'tips') {
      const cats = ['전체', '플레이 팁', '새 조합 제안'];
      root.innerHTML = `
        ${searchToolbarMarkup('게시글 · 작성자 검색', true, pt('write'))}
        <div class="catalog-shell">
          <div class="catalog-tabs-bar">
            <div id="category-filters" class="category-filters">${cats.map(c => `<button data-category="${esc(c)}" class="${c===activeCategory?'active':''}" aria-pressed="${c===activeCategory}">${esc(c)}</button>`).join('')}</div>
          </div>
          <div class="catalog-body">
            <div id="recipe-grid" class="recipe-grid community-view"></div>
          </div>
        </div>
      `;
      bindToolbarEvents(root, () => renderCommunityGridOnly(root));
      $$('[data-category]', root).forEach(b => b.onclick = () => { activeCategory = b.dataset.category; render(); });
      renderCommunityGridOnly(root);
      return;
    }
    if (activeTab === 'suggestions') {
      root.innerHTML = `
        ${searchToolbarMarkup('재료로 추천 조합 검색', true, '조합 제안')}
        <div class="catalog-body" style="margin-top:12px;">
          <div id="recipe-grid" class="recipe-grid suggestions-view"></div>
        </div>
      `;
      bindToolbarEvents(root, () => renderSuggestionsGridOnly(root));
      renderSuggestionsGridOnly(root);
      return;
    }

    // Default: 'recipes' or 'saved'
    const cats = ['전체', '기초 재료', '과일·편의점', '소맥·폭탄주', '막걸리', '특산 명주'];
    root.innerHTML = `
      ${searchToolbarMarkup(pt('search'), false)}
      <div class="catalog-shell">
        <div class="catalog-tabs-bar">
          <div id="category-filters" class="category-filters">${cats.map(c => `<button data-category="${esc(c)}" class="${c===activeCategory?'active':''}" aria-pressed="${c===activeCategory}">${esc(c)}</button>`).join('')}</div>
          ${activeTab === 'recipes' ? `
            <div class="filter-right-controls">
              <div id="recipe-view-toggle" class="view-mode-toggle">
                <button type="button" data-view-mode="grouped" class="${activeViewMode==='grouped'?'is-active':''}">🔓 해금/미해금</button>
                <button type="button" data-view-mode="stage" class="${activeViewMode==='stage'?'is-active':''}">🗺️ 스테이지별</button>
              </div>
              <label class="sort-control"><span class="visually-hidden">정렬 기준</span><select id="sort"><option value="number" ${sort==='number'?'selected':''}>도감 번호순</option><option value="recommended" ${sort==='recommended'?'selected':''}>추천 공략순</option><option value="simple" ${sort==='simple'?'selected':''}>재료가 적은 순</option></select></label>
            </div>
          ` : ''}
        </div>
        <div class="catalog-body">
          ${progressSyncMarkup()}
          <div id="recipe-grid" class="recipe-grid ${['recipes','saved'].includes(activeTab)?'is-sectioned':''}"></div>
        </div>
      </div>
    `;
    bindToolbarEvents(root, () => renderCatalogGridOnly(root));
    bindProgressSyncBar(root);
    $$('[data-category]', root).forEach(b => b.onclick = () => { activeCategory = b.dataset.category; render(); });
    $$('[data-view-mode]', root).forEach(b => b.onclick = () => {
      activeViewMode = b.dataset.viewMode === 'stage' ? 'stage' : 'grouped';
      try { localStorage.setItem('ksool-recipe-view-mode', activeViewMode); } catch (_) {}
      render();
    });
    const sortEl = $('#sort', root);
    if (sortEl) sortEl.onchange = e => { sort = e.target.value; renderCatalogGridOnly(root); };
    renderCatalogGridOnly(root);
  }
  function bindCardActions(root) {
    bindRemoteActions(root);
    $$('[data-reveal-spoiler]',root).forEach(b=>b.onclick=()=>{revealedSpoilers.add(b.dataset.revealSpoiler);render();});
    $$('[data-share-recipe]',root).forEach(b=>b.onclick=(e)=>{e.stopPropagation();const r=byId.get(Number(b.dataset.shareRecipe));shareLink(new URL(`#recipe=${r.recipe_id}`,location.href).href,`${name(r)} · 조합소`);});
    $$('[data-recipe]',root).forEach(b => b.onclick = (e) => {
      const innerBtn = e.target.closest('button');
      if (innerBtn && innerBtn !== b) return;
      navigateRecipe(Number(b.dataset.recipe));
    });
    $$('[data-bookmark]',root).forEach(b => b.onclick = (e) => {
      e.stopPropagation();
      const key=b.dataset.bookmark, saved=bookmarks.has(key);
      saved ? bookmarks.delete(key) : bookmarks.add(key);
      const ok=persist();render();
      b.classList.toggle('is-saved',!saved);b.setAttribute('aria-pressed',String(!saved));
      if(root.id==='recipe-detail' && key.startsWith('r:'))b.classList.toggle('is-saved',!saved);
      if (ok) toast(saved ? '저장 취소' : '저장 완료');
    });
    $$('[data-share-post]',root).forEach(b => b.onclick = () => sharePost(b.dataset.sharePost));
  }
  function bindRemoteActions(root){
    $$('[data-vote-target]',root).forEach(b=>b.onclick=async()=>{b.disabled=true;try{const target=b.dataset.voteTarget;let body;if(target.startsWith('s:')){const key=target.slice(2);const sugObj=mergedSuggestions().find(s=>s.suggestion_key===key);body=sugObj&&!sugObj.fromCommunity?{suggestion_key:key,items:sugObj.items,type:b.dataset.voteType}:{suggestion_key:key,type:b.dataset.voteType};}else{body={post_id:target.slice(2),type:b.dataset.voteType};}await api('/votes',{method:'PUT',body:JSON.stringify(body)});await syncCommunity();$$('[data-vote-target]',document).filter(el=>el.dataset.voteTarget===target).forEach(el=>{const s=target.startsWith('s:')?mergedSuggestions().find(s=>s.suggestion_key===target.slice(2)):posts.find(p=>p.id===target.slice(2));if(s){el.setAttribute('aria-pressed',String(s.myVote===el.dataset.voteType));$('span',el).textContent=el.dataset.voteType==='UP'?s.upvotes:s.downvotes;}});}catch(e){toast(e.message);}finally{b.disabled=false;}});
    $$('[data-delete-post]',root).forEach(b=>b.onclick=async()=>{try{await api('/posts/'+encodeURIComponent(b.dataset.deletePost),{method:'DELETE'});if(root.id==='recipe-detail')$('#recipe-dialog').close();await syncCommunity();}catch(e){toast(e.message);}});
    $$('[data-comments]',root).forEach(b=>b.onclick=()=>openPost(b.dataset.comments).catch(e=>toast(e.message)));
    $$('[data-report]',root).forEach(b=>b.onclick=async()=>{try{await api('/reports',{method:'POST',body:JSON.stringify({post_id:b.dataset.report,reason:'커뮤니티 검토 요청'})});toast('신고 접수');}catch(e){toast(e.message);}});
    $$('[data-copy-combo]',root).forEach(b=>b.onclick=()=>{const url=new URL(location.href);url.hash=new URLSearchParams({suggestion:b.dataset.copyCombo}).toString();shareLink(url.href,'조합 추천 · 조합소');});
  }
  function switchTab(tab,scroll=true) {activeTab=tab;if(tab==='tips')history.replaceState(null,'','#community');else if(tab==='suggestions')history.replaceState(null,'','#recommendations');else if(tab==='rankings')history.replaceState(null,'','#rankings');else if(tab==='updates')history.replaceState(null,'','#updates');else if(tab==='admin')history.replaceState(null,'','#admin');else history.replaceState(null,'',location.pathname+location.search);if(['tips','suggestions','rankings','updates'].includes(tab)){syncCommunity();loadRemoteGameData();}if(tab==='admin'){loadAdminData();}activeCategory='전체';limit=16;render();if(scroll)$('#browse').scrollIntoView({behavior:'smooth',block:'start'});}
  function openDialog(dialog) {
    $$('dialog[open]').forEach(d => {if(d!==dialog)d.close();});
    if(!dialog.open)dialog.showModal();
  }
  function navigateRecipe(id) {
    if(location.hash === `#recipe=${id}`)openRecipe(id);else location.hash=`recipe=${id}`;
  }
  function openRecipe(id) {
    const r=byId.get(id);if(!r)return;
    const related=allPosts().filter(p=>p.recipeId===id);
    const storyMap = gameLinks.stories?.[`rec:${id}`] || {};
    const storyUrl = safeHttpsUrl(storyMap[portalLang] || storyMap.en || storyMap.ko || '');
    const storyHtml = storyUrl
      ? `<a class="button coral" href="${esc(storyUrl)}" target="_blank" rel="noopener noreferrer" style="width:100%; justify-content:center; margin-top:8px; text-decoration:none;">${esc(pt('storyBtn'))} ↗</a>`
      : '';
    if (!isRecipeUnlocked(id)) {
      const modeName = syncedProgress.mode === 'tycoon' ? '타이쿤' : '퀴즈';
      $('#recipe-detail').innerHTML=`<div class="detail-hero"><div class="detail-icon" style="display:grid;place-items:center;width:70px;height:70px;background:#e4e4e7;font-size:2rem;">🔒</div><div><small>${esc(r.formatted_number)} · ${esc(r.category)}</small><h2>${esc(name(r))}</h2></div></div><div class="neo-panel" style="background:#fff9d6; margin:12px 0; font-size:12px; line-height:1.6;"><b>🔒 미해금 레시피입니다.</b><br>현재 선택한 <b>${modeName}</b> 모드에서 아직 해금하지 않아 재료·비율이 비공개 처리되었습니다.<br>오른쪽(또는 상단) <b>play.ksool.minibig.pw</b> 게임에서 조합에 성공한 뒤 Google 계정을 연동하면 자동으로 공개됩니다!</div>${storyHtml}<div class="detail-actions"><a class="button dark" href="https://play.ksool.minibig.pw/" target="_blank" rel="noopener noreferrer">🎮 게임하러 가기 ${uiIcon('arrowUpRight',16)}</a><button id="write-related" aria-label="팁 남기기">${uiIcon('plus',18)}</button></div>${related.length?`<h3 class="detail-subheading">관련 커뮤니티 팁 ${related.length}</h3>${related.map(p=>`<div class="detail-tips"><h4>${esc(p.title)}</h4><p>${renderBodyWithSafeHelpLinks(p.body)}</p></div>`).join('')}`:''}`;
      bindCardActions($('#recipe-detail'));
      $('#write-related').onclick=()=>openCompose(id);
      openDialog($('#recipe-dialog'));
      return;
    }
    $('#recipe-detail').innerHTML=`<div class="detail-hero"><div class="detail-icon">${icon(r,70)}</div><div><small>${esc(r.formatted_number)} · ${esc(r.category)}</small><h2>${esc(name(r))}</h2></div></div><div class="detail-formula">${r.items.map((i,index)=>`<span class="detail-ingredient">${r.requires_order?`${index+1}. `:''}${icon(ingredientFor(i),30)} ${esc(name(ingredientFor(i)))} <b>×${i.ratio}</b></span>`).join('<span>＋</span>')}</div>${r.requires_order?'<p class="detail-note">표시된 순서대로.</p>':''}<details class="hint-details"><summary>힌트</summary><p>${esc(r.unlock_hint || r.description)}</p></details>${storyHtml}<div class="detail-actions"><a class="button dark" href="https://play.ksool.minibig.pw/" target="_blank" rel="noopener noreferrer">K-술 플레이 ${uiIcon('arrowUpRight',16)}</a><button data-bookmark="r:${id}" aria-label="공략 저장" aria-pressed="${bookmarks.has(`r:${id}`)}">${uiIcon('bookmark',18)}</button><button id="share-recipe" aria-label="공략 링크 공유">${uiIcon('share',18)}</button><button id="write-related" aria-label="팁 남기기">${uiIcon('plus',18)}</button></div>${related.length?`<h3 class="detail-subheading">팁 ${related.length}</h3>${related.map(p=>`<div class="detail-tips"><h4>${esc(p.title)}</h4><p>${renderBodyWithSafeHelpLinks(p.body)}</p></div>`).join('')}`:''}`;
    bindCardActions($('#recipe-detail'));
    $('#share-recipe').onclick=()=>shareLink(new URL(`#recipe=${id}`,location.href).href,`${name(r)} 조합 공략 · 조합소`);
    $('#write-related').onclick=()=>openCompose(id);
    openDialog($('#recipe-dialog'));
  }
  async function openPost(id) {
    const post=allPosts().find(p=>p.id===id);if(!post)return;
    $('#recipe-detail').innerHTML=`<h2 style="font-size:25px;margin:23px 0;line-height:1.5">${esc(post.title)}</h2>${postCard(post)}`;
    if(!post.example){
      const data=await api(`/posts/${encodeURIComponent(id)}/comments`);
      $('#recipe-detail').innerHTML+=`<div class="comments-list">${data.comments.map(c=>`<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;"><div><b>${esc(c.author)}</b><p>${renderBodyWithSafeHelpLinks(c.body)}</p></div>${isAdminUser?`<button type="button" class="admin-btn is-danger" data-admin-delete-comment="${esc(c.id)}">삭제</button>`:''}</div>`).join('')}</div><form id="comment-form" class="comment-form"><input name="author" maxlength="16" placeholder="닉네임" aria-label="댓글 닉네임" value="${esc(getDefaultNickname())}" required><input name="body" maxlength="500" placeholder="댓글" aria-label="댓글 내용" required><button class="button coral" aria-label="댓글 등록">${uiIcon('plus',16)}</button></form>`;
      $$('[data-admin-delete-comment]', $('#recipe-detail')).forEach(b => b.onclick = async () => {
        try { await adminApi(`/admin/comments/${encodeURIComponent(b.dataset.adminDeleteComment)}`, { method: 'DELETE' }); toast('댓글 삭제 완료'); await syncCommunity(); await openPost(id); } catch (e) { toast(e.message); }
      });
      $('#comment-form').onsubmit=async event=>{event.preventDefault();const f=new FormData(event.target);try{await api(`/posts/${id}/comments`,{method:'POST',body:JSON.stringify({author:f.get('author').trim(),body:f.get('body').trim()})});await syncCommunity();await openPost(id);}catch(e){toast(e.message);}};
    }
    bindCardActions($('#recipe-detail'));openDialog($('#recipe-dialog'));
  }
  async function shareLink(url,title) {
    try {
      if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(url);toast('링크 복사 완료');}
      else window.prompt('이 링크를 복사해 공유하세요.',url);
    }catch(e){if(e.name!=='AbortError')window.prompt('이 링크를 복사해 공유하세요.',url);}
  }
  function sharePost(id) {
    const p=allPosts().find(p=>p.id===id);if(!p)return;
    const url=new URL(location.href);url.hash=new URLSearchParams(p.example?{note:id}:{thread:id}).toString();
    shareLink(url.href,`${p.title} · 조합소`);
  }
  function openCompose(recipeId=null, defaultKind='tip') {
    $('#compose-error').textContent='';
    const kindSelect = $('#post-kind');
    if (kindSelect) {
      kindSelect.value = defaultKind === 'experiment' ? 'experiment' : 'tip';
      kindSelect.dispatchEvent(new Event('change'));
    }
    const authorInput = $('#compose-form [name=author]');
    if (authorInput && !authorInput.value) authorInput.value = getDefaultNickname();
    if(recipeId)$('#post-recipe').value=String(recipeId);
    openDialog($('#compose-dialog'));
  }
  function addCompositionRow() {
    if($$('.composition-row').length>=4){toast('게임 룰: 재료는 최대 4종류까지 넣을 수 있어요.');return;}
    const avail = getAvailableIngredients();
    const row=document.createElement('div');row.className='composition-row';
    row.innerHTML=`<select class="base-select" aria-label="조합 재료" required><option value="">재료 선택</option>${data.ingredients_base.filter(i=>avail.has(i.ingredient_id)).map(i=>`<option value="${i.ingredient_id}">${esc(name(i))}</option>`).join('')}</select><select class="detail-select" aria-label="상세 재료"><option value="">기본</option></select><input type="number" aria-label="재료 개수" min="1" max="10" value="1" required><button type="button" aria-label="이 재료 삭제">×</button>`;
    $('.base-select',row).onchange=()=>{const id=Number($('.base-select',row).value);$('.detail-select',row).innerHTML='<option value="">기본</option>'+data.ingredients_detail.filter(d=>d.base_ingredient_id===id).map(d=>`<option value="${d.detail_id}">${esc(name(d))}</option>`).join('');};
    $('button',row).onclick=()=>row.remove();$('#composition-rows').append(row);
  }
  async function parseLink() {
    if(location.hash.length>20000){toast('공유 링크가 너무 길어요.');return;}
    if(location.hash==='#community'){activeTab='tips';render();return;}
    if(location.hash==='#recommendations'){activeTab='suggestions';render();return;}
    if(location.hash==='#rankings'){activeTab='rankings';render();return;}
    if(location.hash==='#updates'){activeTab='updates';render();return;}
    if(location.hash==='#admin'){activeTab='admin';loadAdminData();render();return;}
    const params=new URLSearchParams(location.hash.slice(1));
    if(params.has('suggestion')){activeTab='suggestions';query='';render();const target=[...document.querySelectorAll('[data-copy-combo]')].find(el=>el.dataset.copyCombo===params.get('suggestion'));if(target){target.closest('article').classList.add('shared-highlight');target.closest('article').scrollIntoView({block:'center'});}}else if(params.has('recipe')){
      const id=Number(params.get('recipe'));
      if(byId.has(id))openRecipe(id);else toast('이 조합을 찾지 못했어요.');
    }else if(params.has('thread')){try{const {post}=await api('/posts/'+encodeURIComponent(params.get('thread')));if(!posts.some(p=>p.id===post.id))posts.unshift(post);activeTab='tips';render();await openPost(post.id);}catch(e){toast(e.message);}}else if(params.has('note'))openPost(params.get('note'));
    else if(params.has('post')){
      try{
        const p=JSON.parse(params.get('post'));
        if(!validatePost(p))throw new Error('invalid');
        sharedPost={id:p.id,kind:p.kind,title:p.title,body:p.body,author:p.author,recipeId:p.recipeId,...(p.kind==='experiment'?{items:p.items}:{})};
        activeTab='tips';activeCategory='전체';query='';render();openPost(p.id);
      }catch(_){toast('올바른 공유 글을 찾지 못했어요.');}
    }
  }
  $('#recipe-total').textContent=recipes.length;
  syncFromSupabaseUser();
  loadRemoteGameData();
  $('#hero-recipe-icon').innerHTML=icon(byId.get(1),48);
  $$('[data-art]').forEach(el=>el.innerHTML=icon(ingredients.get(Number(el.dataset.art)),34));
  $$('[data-ui-icon]').forEach(el=>el.innerHTML=uiIcon(el.dataset.uiIcon));
  $$('[data-nav]').forEach(b=>b.onclick=()=>switchTab(b.dataset.nav));
  $$('[data-tab]').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab,false));
  $$('[data-open-tip]').forEach(b=>b.onclick=()=>openPost(b.dataset.openTip));
  $$('[data-compose]').forEach(b=>b.onclick=()=>openCompose());
  $$('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
  $$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
  $('#post-kind').onchange=e=>{$('#experiment-fields').hidden=e.target.value!=='experiment';if(e.target.value==='experiment'&&!$$('.composition-row').length){addCompositionRow();addCompositionRow();}$$('#composition-rows select, #composition-rows input').forEach(field=>field.disabled=e.target.value!=='experiment');};
  $('#add-composition-row').onclick=addCompositionRow;
  $('#compose-form').onsubmit=async e=>{
    e.preventDefault();
    const form=e.target;
    const f=new FormData(form);
    const entry={id:crypto.randomUUID ? crypto.randomUUID() : `post-${Date.now()}`,kind:f.get('kind'),title:f.get('title').trim(),body:f.get('body').trim(),author:f.get('author').trim(),recipeId:f.get('recipe')?Number(f.get('recipe')):null};
    if (entry.kind === 'experiment') {
      entry.items = $$('.composition-row').map(row => ({
        ingredient_id: Number($('.base-select', row).value),
        detail_id: $('.detail-select', row).value ? Number($('.detail-select', row).value) : null,
        ratio: Number($('input', row).value)
      }));
      const key = entry.items.map(i => `${i.ingredient_id}:${i.detail_id || 0}@${i.ratio}`).sort().join('+');
      const dupOfficial = officialRecipeKeyMap.get(key);
      if (dupOfficial) {
        $('#compose-error').textContent = `이미 공식 도감에 존재하는 조합입니다 (${dupOfficial.formatted_number} ${name(dupOfficial)}).`;
        return;
      }
    }
    if(!validatePost(entry)){$('#compose-error').textContent=entry.kind==='experiment'?'게임 룰: 중복 없는 2~4종류 재료, 각 1~10개(총합 최대 10개)와 제목·내용을 확인해주세요.':'공백만 입력할 수 없어요. 제목·닉네임·내용을 확인해주세요.';return;}
    const submit=$('[type=submit]',form);submit.disabled=true;
    try{const result=await api('/posts',{method:'POST',body:JSON.stringify(entry)});try{localStorage.setItem('community-nickname',entry.author);}catch(_){}await syncCommunity();}
    catch(error){$('#compose-error').textContent=error.message;submit.disabled=false;return;}
    submit.disabled=false;
    form.reset();$('#experiment-fields').hidden=true;$('#composition-rows').innerHTML='';
    $('#compose-dialog').close();activeTab='tips';query='';switchTab('tips');
    toast('공유 완료');
  };
  document.addEventListener('keydown',e=>{if(e.key==='/'&&!['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)&&!$('dialog[open]')){const s=$('#search');if(s){e.preventDefault();s.focus();$('#browse').scrollIntoView({behavior:'smooth'});}}});
  window.addEventListener('hashchange',()=>{if(location.hash==='#home'){window.scrollTo({top:0,behavior:'smooth'});return;}parseLink();});
  render();
  api('/session').then(()=>syncCommunity()).then(()=>parseLink()).catch(()=>{serverConnected=false;$('#connection-status').textContent='○ 서버 연결 실패';});
  const langSelect = $('#portal-lang-select');
  if (langSelect) {
    langSelect.value = portalLang;
    langSelect.onchange = e => {
      const next = e.target.value;
      if (SUPPORTED_LANGS.includes(next)) {
        portalLang = next;
        try { localStorage.setItem('ksool_lang_v1', next); } catch (_) {}
        render();
      }
    };
  }
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&['tips','suggestions'].includes(activeTab)&&!$('dialog[open]'))syncCommunity();});
})();

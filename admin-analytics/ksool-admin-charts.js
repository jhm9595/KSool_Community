const DEFAULT_ENDPOINT = 'https://jyjxvwxlwkoedxwkkysj.supabase.co/functions/v1/ga-report';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const DONUT_COLORS = ['#ffdc59', '#ff784f', '#c6f35c', '#93c5fd', '#c4b5f7', '#fda4af'];

class KSoolAdminCharts extends HTMLElement {
  static get observedAttributes() {
    return ['endpoint', 'token'];
  }

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this.range = '28d';
    this.hostScope = 'all';
    this.loading = false;
    this.setupError = null;
    this.errorMsg = null;
    this.updatedAt = null;
    this.reports = {};
    this._loadedKey = '';
  }

  connectedCallback() {
    if (!this._renderedOnce) {
      this._renderedOnce = true;
      this.render();
      this.loadAll(false);
    }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (oldVal === newVal) return;
    if (name === 'token' && newVal && this.isConnected) {
      this.loadAll(false);
    }
  }

  getEndpoint() {
    return this.getAttribute('endpoint') || DEFAULT_ENDPOINT;
  }

  getToken() {
    return this.getAttribute('token') || this.dataset.token || '';
  }

  async fetchReport(report, forceRefresh = false) {
    const token = this.getToken();
    if (!token) throw new Error('AUTH_TOKEN_MISSING');
    const res = await fetch(this.getEndpoint(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        report,
        range: this.range,
        hostScope: this.hostScope,
        forceRefresh,
      }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.ok === false) {
      const err = new Error(json.message || json.error || `HTTP ${res.status}`);
      err.code = json.error || `HTTP_${res.status}`;
      throw err;
    }
    if (json.updatedAt) this.updatedAt = json.updatedAt;
    return json.data;
  }

  async loadAll(forceRefresh = false) {
    const token = this.getToken();
    if (!token) {
      this.render();
      return;
    }
    const key = `${this.range}:${this.hostScope}:${forceRefresh ? Date.now() : 'std'}`;
    if (!forceRefresh && this._loadedKey === key && Object.keys(this.reports).length) return;
    this._loadedKey = key;
    this.loading = true;
    this.setupError = null;
    this.errorMsg = null;
    const refBtn = this.shadowRoot?.getElementById('ga-refresh-btn');
    if (refBtn) {
      refBtn.disabled = true;
      refBtn.textContent = '불러오는 중...';
    }

    const names = ['realtime', 'overview', 'sources', 'game_modes', 'funnel_and_levels', 'party_games', 'conversions', 'geo_lang', 'exceptions'];
    try {
      const settled = await Promise.allSettled(names.map((n) => this.fetchReport(n, forceRefresh)));
      const errors = [];
      settled.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          this.reports[names[idx]] = res.value;
        } else {
          const e = res.reason;
          if (e?.code === 'GA_SERVICE_ACCOUNT_JSON_NOT_SET') {
            this.setupError = e.message;
          } else {
            errors.push(`${names[idx]}: ${e?.message || '오류'}`);
          }
        }
      });
      if (errors.length && !this.setupError) {
        this.errorMsg = errors[0];
      }
    } finally {
      this.loading = false;
      this.render();
    }
  }

  deltaBadge(val, suffix = '%') {
    const num = Number(val || 0);
    const cls = num > 0 ? 'up' : num < 0 ? 'down' : 'flat';
    const arrow = num > 0 ? '▲' : num < 0 ? '▼' : '–';
    return `<span class="delta ${cls}">${arrow} ${num > 0 ? '+' : ''}${num}${suffix}</span>`;
  }

  fillDailySeries(series) {
    if (!series || !series.length) return [];
    const byDate = new Map(series.map((d) => [d.date, d]));
    const start = new Date(`${series[0].date}T00:00:00Z`);
    const end = new Date(`${series[series.length - 1].date}T00:00:00Z`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return series;
    const filled = [];
    for (let t = start.getTime(); t <= end.getTime(); t += 86400000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      filled.push(byDate.get(iso) || { date: iso, gameUsers: 0, siteUsers: 0 });
    }
    return filled;
  }

  renderDualLineSvg(rawSeries, hostScope = 'all', range = '28d') {
    const series = this.fillDailySeries(rawSeries);
    if (!series.length) return '<p class="muted">표시할 일별 방문자 데이터가 없습니다.</p>';

    const showGame = hostScope !== 'site';
    const showSite = hostScope !== 'game';
    const rangeDays = range === '7d' ? 7 : range === '90d' ? 90 : 28;
    const firstDate = series[0].date;
    const lastDate = series[series.length - 1].date;

    const w = 680;
    const h = 210;
    const padL = 40;
    const padR = 16;
    const padT = 18;
    const padB = 28;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const visibleVals = series.flatMap((d) => [
      ...(showGame ? [d.gameUsers || 0] : []),
      ...(showSite ? [d.siteUsers || 0] : []),
    ]);
    const maxVal = Math.max(10, ...visibleVals);
    const xFor = (i) => (series.length === 1 ? padL + plotW / 2 : padL + (i / (series.length - 1)) * plotW);
    const yFor = (v) => padT + plotH - (v / maxVal) * plotH;
    const pathFor = (key) => series.map((d, i) => `${i === 0 ? 'M' : 'L'}${xFor(i).toFixed(1)},${yFor(d[key] || 0).toFixed(1)}`).join(' ');

    const ticks = [0, 0.5, 1].map((t) => {
      const val = Math.round(maxVal * t);
      const y = yFor(val).toFixed(1);
      return `<line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#d6d0c0" stroke-dasharray="3 3"/><text x="${padL - 6}" y="${Number(y) + 4}" text-anchor="end" font-size="10" fill="#666357">${val}</text>`;
    }).join('');

    const stepX = Math.max(1, Math.ceil(series.length / 7));
    const xLabels = series.map((d, i) => {
      if (i % stepX !== 0 && i !== series.length - 1) return '';
      return `<text x="${xFor(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="10" fill="#666357">${esc(d.date.slice(5))}</text>`;
    }).join('');

    const legendItems = [
      showGame ? `<span><i class="dot" style="background:#2563eb"></i>게임 (play.ksool)</span>` : '',
      showSite ? `<span><i class="dot" style="background:#16a34a"></i>커뮤니티 (ksool)</span>` : '',
    ].filter(Boolean).join('');

    const guideLines = series.map((d, i) => {
      const x = xFor(i).toFixed(1);
      return `<line class="hover-vline" data-vline="${i}" x1="${x}" y1="${padT}" x2="${x}" y2="${padT + plotH}" stroke="#191919" stroke-width="1.5" stroke-dasharray="3 2" opacity="0"/>`;
    }).join('');

    const dots = series.map((d, i) => [
      showGame ? `<circle class="chart-dot" data-dot-idx="${i}" cx="${xFor(i).toFixed(1)}" cy="${yFor(d.gameUsers || 0).toFixed(1)}" r="3.8" fill="#2563eb" stroke="#191919" stroke-width="1.2"/>` : '',
      showSite ? `<circle class="chart-dot" data-dot-idx="${i}" cx="${xFor(i).toFixed(1)}" cy="${yFor(d.siteUsers || 0).toFixed(1)}" r="3.8" fill="#191919" style="fill:#16a34a" stroke="#191919" stroke-width="1.2"/>` : '',
    ].join('')).join('');

    const hitCols = series.map((d, i) => {
      const prevX = i === 0 ? padL : (xFor(i - 1) + xFor(i)) / 2;
      const nextX = i === series.length - 1 ? w - padR : (xFor(i) + xFor(i + 1)) / 2;
      const colW = Math.max(8, nextX - prevX);
      const prevDay = i > 0 ? series[i - 1] : null;
      const g = Number(d.gameUsers || 0);
      const s = Number(d.siteUsers || 0);
      const tot = (showGame ? g : 0) + (showSite ? s : 0);
      const prevTot = prevDay ? ((showGame ? Number(prevDay.gameUsers || 0) : 0) + (showSite ? Number(prevDay.siteUsers || 0) : 0)) : null;
      const diff = prevTot !== null ? tot - prevTot : null;
      return `<rect class="hover-col" data-chart-idx="${i}" data-date="${esc(d.date)}" data-game="${g}" data-site="${s}" data-tot="${tot}" data-diff="${diff !== null ? diff : ''}" data-x-pct="${((xFor(i) / w) * 100).toFixed(2)}" x="${prevX.toFixed(1)}" y="${padT}" width="${colW.toFixed(1)}" height="${plotH + padB}" fill="transparent"/>`;
    }).join('');

    this._lastSeriesMeta = { showGame, showSite };

    return `
      <div class="legend-row" style="justify-content:space-between;align-items:center;">
        <div style="display:flex;gap:14px;flex-wrap:wrap;">${legendItems}</div>
        <span class="muted" style="font-size:11px;">조회: 최근 ${rangeDays}일 · 실제 데이터: ${esc(firstDate)} ~ ${esc(lastDate)} (${series.length}일)</span>
      </div>
      <div class="chart-wrap" id="daily-chart-wrap">
        <svg viewBox="0 0 ${w} ${h}" class="line-svg" role="img" aria-label="일별 사이트 vs 게임 방문자 추이">
          ${ticks}
          ${xLabels}
          ${guideLines}
          ${showGame ? `<path d="${pathFor('gameUsers')}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>` : ''}
          ${showSite ? `<path d="${pathFor('siteUsers')}" fill="none" stroke="#16a34a" stroke-width="3" stroke-linejoin="round"/>` : ''}
          ${dots}
          ${hitCols}
        </svg>
        <div id="line-chart-tooltip" class="chart-tooltip" hidden></div>
      </div>
    `;
  }

  renderDonutSvg(modes) {
    if (!modes || !modes.length) return '<p class="muted">플레이 데이터가 아직 없습니다.</p>';
    const total = modes.reduce((s, m) => s + (m.plays || 0), 0) || 1;
    let acc = 0;
    const r = 56;
    const cx = 74;
    const cy = 74;
    const circ = 2 * Math.PI * r;
    const segments = modes.map((m, idx) => {
      const len = (m.plays / total) * circ;
      const dash = `${len.toFixed(2)} ${(circ - len).toFixed(2)}`;
      const offset = (-acc).toFixed(2);
      acc += len;
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${DONUT_COLORS[idx % DONUT_COLORS.length]}" stroke-width="24" stroke-dasharray="${dash}" stroke-dashoffset="${offset}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(m.label)}: ${m.plays}회 (${m.sharePct}%)</title></circle>`;
    }).join('');

    return `
      <div class="donut-wrap">
        <svg viewBox="0 0 148 148" class="donut-svg" role="img" aria-label="인기 모드 점유율">
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ece8dc" stroke-width="24"/>
          ${segments}
          <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="16" font-weight="900" fill="#191919">${total.toLocaleString()}</text>
          <text x="${cx}" y="${cy + 13}" text-anchor="middle" font-size="9" font-weight="700" fill="#666357">총 플레이</text>
        </svg>
        <div class="donut-list">
          ${modes.map((m, idx) => `
            <div class="donut-item">
              <span class="donut-name"><i class="dot" style="background:${DONUT_COLORS[idx % DONUT_COLORS.length]}"></i>${esc(m.label)}</span>
              <span class="donut-meta"><b>${m.sharePct}%</b> · ${m.plays.toLocaleString()}회 · ${esc(m.avgDurationFormatted)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  render() {
    const rt = this.reports.realtime || {};
    const ov = this.reports.overview || {};
    const kpis = ov.kpis || {};
    const src = this.reports.sources?.sources || [];
    const srcMeta = this.reports.sources?.separatedMeta || {};
    const gm = this.reports.game_modes?.modes || [];
    const fn = this.reports.funnel_and_levels || {};
    const pg = this.reports.party_games?.partyGames || [];
    const cv = this.reports.conversions || {};
    const ad = cv.adSummary || {};
    const out = cv.outboundClicks || {};
    const soc = cv.socialAndAccount || {};
    const geo = this.reports.geo_lang || {};
    const exc = this.reports.exceptions?.exceptions || [];

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family:inherit; color:#191919; }
        * { box-sizing:border-box; }
        .ga-shell { display:flex; flex-direction:column; gap:14px; }
        .ga-toolbar { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; padding:10px 14px; border:2px solid #191919; background:#e0f2fe; box-shadow:3px 3px 0 #191919; }
        .ga-title { font-size:14px; font-weight:900; display:flex; align-items:center; gap:8px; }
        .ga-controls { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .seg { display:inline-flex; border:1.5px solid #191919; background:#fffdf5; }
        .seg button { border:0; background:transparent; padding:5px 10px; font-size:11px; font-weight:800; cursor:pointer; color:#191919; transition:background-color .18s ease, color .18s ease; }
        .seg button+button { border-left:1.5px solid #191919; }
        .seg button.is-active { background:#ffdc59; }
        .btn { padding:6px 11px; border:1.5px solid #191919; background:#c6f35c; font-size:11px; font-weight:850; cursor:pointer; box-shadow:2px 2px 0 #191919; transition:transform .16s ease, box-shadow .16s ease, opacity .18s ease; }
        .btn:hover:not(:disabled) { transform:translate(-1px,-1px); box-shadow:3px 3px 0 #191919; }
        .btn:disabled { opacity:.6; cursor:wait; }
        .muted { color:#666357; font-size:12px; margin:0; }
        .banner-warn { padding:16px; border:2px solid #191919; background:#fff3cd; box-shadow:3px 3px 0 #191919; font-size:12px; line-height:1.65; }
        .banner-err { padding:14px; border:2px solid #191919; background:#ffb6a0; font-size:12px; font-weight:750; }
        .kpi-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(175px,1fr)); gap:10px; }
        .kpi-card { border:2px solid #191919; background:#fffdf5; padding:12px; box-shadow:3px 3px 0 #191919; display:flex; flex-direction:column; gap:5px; }
        .kpi-card.is-live { background:#d5f88a; }
        .kpi-label { font-size:11px; font-weight:800; color:#525046; }
        .kpi-val { font-size:22px; font-weight:950; letter-spacing:-0.5px; }
        .delta { font-size:11px; font-weight:850; }
        .delta.up { color:#15803d; }
        .delta.down { color:#b91c1c; }
        .delta.flat { color:#666357; }
        .panel { border:2px solid #191919; background:#fffdf5; padding:14px; box-shadow:3px 3px 0 #191919; }
        .panel h4 { margin:0 0 10px; font-size:14px; font-weight:900; }
        .grid-2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:14px; }
        .legend-row { display:flex; gap:14px; font-size:11px; font-weight:800; margin-bottom:6px; flex-wrap:wrap; }
        .dot { display:inline-block; width:10px; height:10px; border:1px solid #191919; margin-right:5px; vertical-align:middle; }
        .chart-wrap { position:relative; }
        .line-svg { width:100%; height:auto; display:block; }
        .hover-col { cursor:crosshair; }
        .chart-dot { transition:r .15s ease, stroke-width .15s ease; pointer-events:none; }
        .chart-dot.is-hover { r:6px; stroke-width:2px; }
        .hover-vline { transition:opacity .15s ease; pointer-events:none; }
        .hover-vline.is-hover { opacity:0.65; }
        .chart-tooltip { position:absolute; top:8px; z-index:10; min-width:165px; padding:8px 10px; border:2px solid #191919; background:#fffdf5; box-shadow:3px 3px 0 #191919; font-size:11px; line-height:1.55; pointer-events:none; transform:translateX(-50%); }
        .chart-tooltip.align-left { transform:translateX(0); }
        .chart-tooltip.align-right { transform:translateX(-100%); }
        .chart-tooltip-date { font-weight:950; font-size:12px; border-bottom:1.5px solid #191919; padding-bottom:3px; margin-bottom:4px; display:flex; justify-content:space-between; gap:8px; }
        .chart-tooltip-row { display:flex; justify-content:space-between; gap:10px; font-weight:800; }
        .chart-tooltip-foot { margin-top:4px; padding-top:3px; border-top:1px dashed #bcb5a0; display:flex; justify-content:space-between; gap:8px; font-weight:900; }
        .hbar-list { display:flex; flex-direction:column; gap:8px; }
        .hbar-row { display:flex; flex-direction:column; gap:3px; font-size:11px; }
        .hbar-head { display:flex; justify-content:space-between; gap:8px; font-weight:800; }
        .hbar-track { height:12px; border:1.5px solid #191919; background:#efeadd; overflow:hidden; display:flex; }
        .hbar-fill { height:100%; background:#ffdc59; transition:width .3s cubic-bezier(.22,1,.36,1); }
        .donut-wrap { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
        .donut-svg { width:148px; height:148px; flex-shrink:0; }
        .donut-list { flex:1; min-width:200px; display:flex; flex-direction:column; gap:7px; }
        .donut-item { display:flex; justify-content:space-between; gap:8px; font-size:11px; padding:4px 6px; border:1px solid #d6d0c0; background:#faf7ed; }
        .donut-name { font-weight:850; }
        .donut-meta { font-family:ui-monospace,Consolas,monospace; color:#45443d; white-space:nowrap; }
        .tbl { width:100%; border-collapse:collapse; font-size:11px; margin-top:10px; }
        .tbl th,.tbl td { border:1px solid #191919; padding:5px 7px; text-align:left; }
        .tbl th { background:#f3f0e7; font-weight:900; }
        .warn-badge { display:inline-block; margin-left:6px; padding:1px 6px; border:1px solid #191919; background:#ffb6a0; font-size:10px; font-weight:900; }
        .stack-win { background:#4ade80; height:100%; transition:width .3s cubic-bezier(.22,1,.36,1); }
        .stack-lose { background:#f87171; height:100%; transition:width .3s cubic-bezier(.22,1,.36,1); }
        .stack-quit { background:#cbd5e1; height:100%; transition:width .3s cubic-bezier(.22,1,.36,1); }
        .mini-cards { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
        .mini-card { border:1.5px solid #191919; background:#faf7ed; padding:8px 10px; }
        .mini-card b { display:block; font-size:17px; font-weight:950; margin-top:2px; }
        .mini-card small { font-size:10px; font-weight:800; color:#525046; }
      </style>

      <div class="ga-shell">
        <div class="ga-toolbar">
          <div class="ga-title">
            <span>📊 사이트 + 게임 통합 GA4 통계 (블로그 제외)</span>
            ${this.updatedAt ? `<span class="muted">· 갱신 ${esc(new Date(this.updatedAt).toLocaleTimeString('ko-KR'))}</span>` : ''}
          </div>
          <div class="ga-controls">
            <div class="seg" role="group" aria-label="대상 범위">
              <button type="button" data-scope="all" class="${this.hostScope === 'all' ? 'is-active' : ''}">전체(사이트+게임)</button>
              <button type="button" data-scope="game" class="${this.hostScope === 'game' ? 'is-active' : ''}">게임만</button>
              <button type="button" data-scope="site" class="${this.hostScope === 'site' ? 'is-active' : ''}">사이트만</button>
            </div>
            <div class="seg" role="group" aria-label="조회 기간">
              <button type="button" data-range="7d" class="${this.range === '7d' ? 'is-active' : ''}">7일</button>
              <button type="button" data-range="28d" class="${this.range === '28d' ? 'is-active' : ''}">28일</button>
              <button type="button" data-range="90d" class="${this.range === '90d' ? 'is-active' : ''}">90일</button>
            </div>
            <button type="button" id="ga-refresh-btn" class="btn" ${this.loading ? 'disabled' : ''}>${this.loading ? '불러오는 중...' : '↻ 정보 갱신'}</button>
          </div>
        </div>

        ${this.setupError ? `
          <div class="banner-warn">
            <strong>🔧 GA4 서비스 계정 연동 대기 중</strong><br>
            ${esc(this.setupError)}<br>
            <small>1) Google Cloud Console에서 Analytics Data API 활성화 후 서비스 계정 JSON 키 발급 → 2) GA4 속성(<code>564332931</code>)에 뷰어 권한 추가 → 3) Supabase Secrets에 <code>GA_SERVICE_ACCOUNT_JSON</code> 등록 후 새로고침하세요.</small>
          </div>
        ` : ''}
        ${this.errorMsg ? `<div class="banner-err">⚠️ ${esc(this.errorMsg)}</div>` : ''}

        <!-- 위젯 1: 상단 KPI 5개 -->
        <div class="kpi-grid">
          <div class="kpi-card is-live">
            <span class="kpi-label">🟢 실시간 접속자 (30분)</span>
            <span class="kpi-val">${Number(rt.activeUsersNow || 0).toLocaleString()}명</span>
            <span class="muted">${(rt.topScreens || []).slice(0, 2).map((s) => `${esc(s.title.slice(0, 14))}(${s.users})`).join(' · ') || '대기 중'}</span>
          </div>
          <div class="kpi-card">
            <span class="kpi-label">순 방문자 수</span>
            <span class="kpi-val">${Number(kpis.activeUsers?.value || 0).toLocaleString()}명</span>
            ${this.deltaBadge(kpis.activeUsers?.deltaPct)}
          </div>
          <div class="kpi-card">
            <span class="kpi-label">재방문자 비율</span>
            <span class="kpi-val">${kpis.returningRatePct?.value ?? 0}%</span>
            ${this.deltaBadge(kpis.returningRatePct?.deltaPct, '%p')}
          </div>
          <div class="kpi-card">
            <span class="kpi-label">1인당 평균 체류시간</span>
            <span class="kpi-val">${esc(kpis.avgEngagementSec?.formatted || '0초')}</span>
            ${this.deltaBadge(kpis.avgEngagementSec?.deltaPct)}
          </div>
          <div class="kpi-card">
            <span class="kpi-label">사이트 vs 게임 비율</span>
            <span class="kpi-val" style="font-size:16px;">사이트 ${kpis.hostShare?.sitePct ?? 0}% : 게임 ${kpis.hostShare?.gamePct ?? 0}%</span>
            <div class="hbar-track"><div class="hbar-fill" style="width:${kpis.hostShare?.sitePct ?? 0}%;background:#16a34a"></div><div class="hbar-fill" style="width:${kpis.hostShare?.gamePct ?? 0}%;background:#2563eb"></div></div>
          </div>
        </div>

        <!-- 위젯 2: 사이트 vs 게임 추이 -->
        <section class="panel">
          <h4>📈 방문자가 매일 늘고 있나? (사이트 vs 게임 추이)</h4>
          ${this.renderDualLineSvg(ov.dailySeries || [], this.hostScope, this.range)}
        </section>

        <div class="grid-2">
          <!-- 위젯 3: 유입 경로 -->
          <section class="panel">
            <h4>🧭 사람들이 어디서 알고 찾아왔나?</h4>
            ${src.length ? `
              <div class="hbar-list">
                ${src.slice(0, 8).map((s) => {
                  const maxU = Math.max(1, src[0]?.users || 1);
                  const cleanCamp = String(s.campaign || '').replace(/^\(+|\)+$/g, '').trim();
                  const showCamp = cleanCamp && !['direct', 'referral', 'organic', 'not set', 'none'].includes(cleanCamp.toLowerCase());
                  const gameMeta = this.hostScope === 'all' ? ` · 게임 ${s.gameSharePct}%` : '';
                  return `<div class="hbar-row"><div class="hbar-head"><span>${esc(s.label)}${showCamp ? ` <small style="color:#666357;">(${esc(cleanCamp)})</small>` : ''}</span><span style="white-space:nowrap;"><b>${s.users.toLocaleString()}명</b> · 참여 ${s.engagementRatePct}%${gameMeta} · 체류 ${esc(s.avgDurationFormatted)}</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((s.users / maxU) * 100)}%"></div></div></div>`;
                }).join('')}
              </div>
              ${(srcMeta.oauthRedirects > 0 || srcMeta.testReferrals > 0) ? `<p class="muted" style="margin-top:10px;">🔐 분리된 경로: 구글 로그인 복귀 ${srcMeta.oauthRedirects || 0}명 · 테스트 유입 ${srcMeta.testReferrals || 0}명</p>` : ''}
            ` : '<p class="muted">유입 경로 데이터가 아직 없습니다.</p>'}
          </section>

          <!-- 위젯 4: 인기 게임 모드 -->
          <section class="panel">
            <h4>🎮 게임에 들어와서 어느 모드를 가장 많이 하나?</h4>
            ${this.renderDonutSvg(gm)}
          </section>
        </div>

        <!-- 위젯 5: 온보딩 퍼널 & 단계별 막힘 구간 -->
        <section class="panel">
          <h4>🪜 튜토리얼부터 몇 단계까지 깨고 어디서 포기하나?</h4>
          <div class="grid-2">
            <div>
              <p class="muted" style="margin-bottom:8px;font-weight:800;">초반 온보딩 통과율</p>
              ${(fn.onboardingFunnel || []).length ? `
                <div class="hbar-list">
                  ${(fn.onboardingFunnel || []).map((f) => `
                    <div class="hbar-row">
                      <div class="hbar-head"><span>${esc(f.step)}</span><span>${f.users.toLocaleString()}명 (${f.rateFromStartPct}%${f.dropOffPct > 0 ? ` · 이탈 -${f.dropOffPct}%` : ''})</span></div>
                      <div class="hbar-track"><div class="hbar-fill" style="width:${f.rateFromStartPct}%;background:#93c5fd"></div></div>
                    </div>
                  `).join('')}
                </div>
              ` : '<p class="muted">온보딩 퍼널 데이터가 아직 없습니다.</p>'}
            </div>
            <div>
              <p class="muted" style="margin-bottom:8px;font-weight:800;">단계별 클리어(🟢) / 실패(🔴) / 중도포기(⚪)</p>
              ${(fn.stageBreakdown || []).length ? `
                <div class="hbar-list">
                  ${(fn.stageBreakdown || []).slice(0, 12).map((s) => {
                    const tot = Math.max(1, s.winCount + s.loseCount + s.quitCount);
                    const wPct = Math.round((s.winCount / tot) * 100);
                    const lPct = Math.round((s.loseCount / tot) * 100);
                    const qPct = Math.max(0, 100 - wPct - lPct);
                    return `
                      <div class="hbar-row">
                        <div class="hbar-head">
                          <span>${esc(s.gameModeLabel)} · ${esc(s.levelLabel)}${s.warningBadge ? `<span class="warn-badge">${esc(s.warningBadge)}</span>` : ''}</span>
                          <span>클리어 ${s.clearRatePct}% (${esc(s.avgDurationFormatted)})</span>
                        </div>
                        <div class="hbar-track"><div class="stack-win" style="width:${wPct}%"></div><div class="stack-lose" style="width:${lPct}%"></div><div class="stack-quit" style="width:${qPct}%"></div></div>
                      </div>
                    `;
                  }).join('')}
                </div>
              ` : '<p class="muted">단계별 클리어 데이터가 아직 없습니다.</p>'}
            </div>
          </div>
        </section>

        <div class="grid-2">
          <!-- 위젯 6: 술자리 파티 미니게임 10종 순위 -->
          <section class="panel">
            <h4>🍻 술자리 파티 미니게임 10종 인기 순위</h4>
            ${pg.length ? `
              <div class="hbar-list">
                ${pg.map((g, i) => {
                  const maxP = Math.max(1, pg[0]?.plays || 1);
                  return `<div class="hbar-row"><div class="hbar-head"><span>#${i + 1} ${esc(g.label)}</span><span>${g.plays.toLocaleString()}판 · ${g.users}명 · ${esc(g.avgDurationFormatted)} (완주 ${g.completionRatePct}%)</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((g.plays / maxP) * 100)}%;background:#ff784f"></div></div></div>`;
                }).join('')}
              </div>
            ` : '<p class="muted">술자리 미니게임 플레이 데이터가 아직 없습니다.</p>'}
          </section>

          <!-- 위젯 7: 보상형 광고 · 제휴/스토리 · 공유 · 로그인 -->
          <section class="panel">
            <h4>💰 광고 시청 · 스토리/제휴 클릭 · 공유 &amp; 로그인 전환</h4>
            <div class="mini-cards" style="margin-bottom:10px;">
              <div class="mini-card"><small>보상형 광고 완료율</small><b>${ad.completionRatePct ?? 0}% (${ad.completes ?? 0}/${ad.starts ?? 0})</b></div>
              <div class="mini-card"><small>유래/영상 &amp; 제휴 클릭</small><b>스토리 ${out.storyLinkClicks ?? 0} · 제휴 ${out.affiliateBuyClicks ?? 0}</b></div>
              <div class="mini-card"><small>친구 SOS / 레시피 공유</small><b>${soc.shareCount ?? 0}회</b></div>
              <div class="mini-card"><small>구글 로그인 / 가입 · 해금</small><b>가입 ${soc.googleSignUps ?? 0} · 로그인 ${soc.googleLogins ?? 0} · 해금 ${soc.recipeUnlocks ?? 0}</b></div>
            </div>
            ${(ad.byPlacement || []).length ? `
              <div class="hbar-list">
                ${(ad.byPlacement || []).map((a) => `<div class="hbar-row"><div class="hbar-head"><span>${esc(a.label)}</span><span>${a.completes}/${a.starts} (${a.ratePct}%)</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${a.ratePct}%;background:#c6f35c"></div></div></div>`).join('')}
              </div>
            ` : '<p class="muted">광고 및 전환 이벤트가 아직 수집되지 않았습니다.</p>'}
          </section>
        </div>

        <div class="grid-2">
          <!-- 위젯 8: 국가 & 언어 분포 -->
          <section class="panel">
            <h4>🌍 어느 나라·언어권 유저가 늘고 있나?</h4>
            <div class="grid-2" style="gap:10px;">
              <div>
                <p class="muted" style="margin-bottom:6px;font-weight:800;">접속 국가 TOP 5</p>
                ${(geo.countries || []).length ? `
                  <div class="hbar-list">
                    ${(geo.countries || []).slice(0, 5).map((c) => {
                      const maxC = Math.max(1, geo.countries[0]?.users || 1);
                      return `<div class="hbar-row"><div class="hbar-head"><span>${esc(c.country)}</span><span>${c.users.toLocaleString()}명</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((c.users / maxC) * 100)}%;background:#93c5fd"></div></div></div>`;
                    }).join('')}
                  </div>
                ` : '<p class="muted">국가 데이터가 아직 없습니다.</p>'}
              </div>
              <div>
                <p class="muted" style="margin-bottom:6px;font-weight:800;">인게임 언어 분포</p>
                ${(geo.languages || []).length ? `
                  <div class="hbar-list">
                    ${(geo.languages || []).slice(0, 5).map((l) => {
                      const maxL = Math.max(1, geo.languages[0]?.users || 1);
                      return `<div class="hbar-row"><div class="hbar-head"><span>${esc(l.lang)}</span><span>${l.users.toLocaleString()}명 (${l.events}회)</span></div><div class="hbar-track"><div class="hbar-fill" style="width:${Math.round((l.users / maxL) * 100)}%;background:#c4b5f7"></div></div></div>`;
                    }).join('')}
                  </div>
                ` : '<p class="muted">언어 설정 데이터가 아직 없습니다.</p>'}
              </div>
            </div>
          </section>

          <!-- 위젯 9: 게임 내 JS 오류 실시간 모니터링 -->
          <section class="panel">
            <h4>🐞 게임 중 에러가 터지고 있지는 않나? (최근 7일 · 한국시간)</h4>
            ${exc.length ? `
              <table class="tbl"><thead><tr><th>오류 내용</th><th>최근 발생 (KST)</th><th>모드</th><th>횟수</th><th>유저</th></tr></thead><tbody>
                ${exc.slice(0, 10).map((e) => `<tr><td>${esc(e.description)}${e.warningBadge ? `<span class="warn-badge">${esc(e.warningBadge)}</span>` : ''}</td><td style="white-space:nowrap;">${esc(e.lastOccurredKst || '-')}</td><td>${esc(e.gameMode)}</td><td>${e.count}</td><td>${e.users}</td></tr>`).join('')}
              </tbody></table>
              <p class="muted" style="margin-top:6px;font-size:11px;">※ GA4 표준 리포트는 한국시간(KST) 기준 분(MM/DD HH:MM) 단위까지 제공됩니다.</p>
            ` : '<p class="muted">최근 7일간 수집된 게임 JS 오류가 없습니다. ✅</p>'}
          </section>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll('[data-scope]').forEach((b) => {
      b.onclick = () => {
        if (this.hostScope === b.dataset.scope) return;
        this.hostScope = b.dataset.scope;
        this.shadowRoot.querySelectorAll('[data-scope]').forEach((x) => x.classList.toggle('is-active', x === b));
        this.loadAll(false);
      };
    });
    this.shadowRoot.querySelectorAll('[data-range]').forEach((b) => {
      b.onclick = () => {
        if (this.range === b.dataset.range) return;
        this.range = b.dataset.range;
        this.shadowRoot.querySelectorAll('[data-range]').forEach((x) => x.classList.toggle('is-active', x === b));
        this.loadAll(false);
      };
    });
    const refBtn = this.shadowRoot.getElementById('ga-refresh-btn');
    if (refBtn) refBtn.onclick = () => this.loadAll(true);

    const chartWrap = this.shadowRoot.getElementById('daily-chart-wrap');
    const tooltip = this.shadowRoot.getElementById('line-chart-tooltip');
    if (chartWrap && tooltip) {
      const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
      const { showGame = true, showSite = true } = this._lastSeriesMeta || {};
      const clearHover = () => {
        tooltip.hidden = true;
        chartWrap.querySelectorAll('.chart-dot.is-hover, .hover-vline.is-hover').forEach((el) => el.classList.remove('is-hover'));
      };
      chartWrap.querySelectorAll('.hover-col').forEach((col) => {
        col.addEventListener('mouseenter', () => {
          const idx = col.dataset.chartIdx;
          const dateStr = col.dataset.date || '';
          const g = Number(col.dataset.game || 0);
          const s = Number(col.dataset.site || 0);
          const tot = Number(col.dataset.tot || 0);
          const diffRaw = col.dataset.diff;
          const xPct = Number(col.dataset.xPct || 50);
          const dt = new Date(`${dateStr}T00:00:00Z`);
          const dayLabel = !Number.isNaN(dt.getTime()) ? ` (${weekdays[dt.getUTCDay()]})` : '';
          const gPct = tot > 0 ? Math.round((g / tot) * 1000) / 10 : 0;
          const sPct = tot > 0 ? Math.round((s / tot) * 1000) / 10 : 0;
          let diffHtml = '';
          if (diffRaw !== '') {
            const dNum = Number(diffRaw);
            const cls = dNum > 0 ? 'up' : dNum < 0 ? 'down' : 'flat';
            const sign = dNum > 0 ? `▲ +${dNum}명` : dNum < 0 ? `▼ ${dNum}명` : '– 변동없음';
            diffHtml = `<span class="delta ${cls}">전일비 ${sign}</span>`;
          }

          chartWrap.querySelectorAll('.chart-dot.is-hover, .hover-vline.is-hover').forEach((el) => el.classList.remove('is-hover'));
          chartWrap.querySelectorAll(`[data-dot-idx="${idx}"], [data-vline="${idx}"]`).forEach((el) => el.classList.add('is-hover'));

          tooltip.innerHTML = `
            <div class="chart-tooltip-date"><span>📅 ${esc(dateStr)}${dayLabel}</span></div>
            ${showGame ? `<div class="chart-tooltip-row"><span><i class="dot" style="background:#2563eb"></i>게임</span><span>${g.toLocaleString()}명${showSite ? ` (${gPct}%)` : ''}</span></div>` : ''}
            ${showSite ? `<div class="chart-tooltip-row"><span><i class="dot" style="background:#16a34a"></i>커뮤니티</span><span>${s.toLocaleString()}명${showGame ? ` (${sPct}%)` : ''}</span></div>` : ''}
            <div class="chart-tooltip-foot"><span>${showGame && showSite ? `합계 ${tot.toLocaleString()}명` : `방문 ${tot.toLocaleString()}명`}</span>${diffHtml}</div>
          `;
          tooltip.classList.toggle('align-left', xPct < 22);
          tooltip.classList.toggle('align-right', xPct > 78);
          tooltip.style.left = `${xPct}%`;
          tooltip.hidden = false;
        });
      });
      chartWrap.addEventListener('mouseleave', clearHover);
    }
  }
}

if (!customElements.get('ksool-admin-charts')) {
  customElements.define('ksool-admin-charts', KSoolAdminCharts);
}

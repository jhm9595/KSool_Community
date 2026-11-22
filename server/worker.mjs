import catalog from './catalog.mjs';

const ingredientMap = new Map(catalog.ingredients.map(i=>[i.ingredient_id,i]));
const detailMap = new Map(catalog.details.map(i=>[i.detail_id,i]));
const recipeIds = new Set(catalog.recipes.map(r=>r.recipe_id));
const officialRecipeKeys = (() => {
  const byRec = new Map();
  for (const ri of (catalog.recipe_ingredients || [])) {
    if (!byRec.has(ri.recipe_id)) byRec.set(ri.recipe_id, []);
    byRec.get(ri.recipe_id).push(ri);
  }
  const map = new Map();
  for (const r of catalog.recipes) {
    const items = byRec.get(r.recipe_id) || [];
    if (!items.length) continue;
    const key = items.map(i => `${i.ingredient_id}:${i.detail_ingredient_id||i.detail_id||0}@${i.ratio}`).sort().join('+');
    map.set(key, r);
  }
  return map;
})();
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
const str=(value,min,max,label)=>{if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw problem(`${label} 확인`);return value.trim();};
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const now=()=>Date.now();
const cursor=(raw)=>{if(!raw)return [Number.MAX_SAFE_INTEGER,'~'];const [time,...id]=raw.split('|');return [Number(time)||Number.MAX_SAFE_INTEGER,id.join('|')||'~'];};
export function normalizeItems(input){
  if(!Array.isArray(input)||input.length<2||input.length>4)throw problem('게임 룰: 재료는 2~4종류까지 넣을 수 있습니다');
  const seen=new Set();
  const items=input.map(i=>{
    if(!i||!Number.isInteger(i.ingredient_id)||!ingredientMap.has(i.ingredient_id)||!Number.isInteger(i.ratio)||i.ratio<1||i.ratio>10)throw problem('재료·개수(1~10) 확인');
    const detail=i.detail_id ?? i.detail_ingredient_id ?? null;
    if(detail!==null&&(!Number.isInteger(detail)||detailMap.get(detail)?.base_ingredient_id!==i.ingredient_id))throw problem('상세 재료 확인');
    const key=`${i.ingredient_id}:${detail||0}`;
    if(seen.has(key))throw problem('중복 재료');seen.add(key);
    return {ingredient_id:i.ingredient_id,detail_id:detail,ratio:i.ratio};
  });
  if(items.reduce((sum,i)=>sum+i.ratio,0)>10)throw problem('게임 룰: 총 재료 개수는 최대 10개입니다');
  return items;
}
function ensureNotOfficialRecipe(key){
  const match=officialRecipeKeys.get(key);
  if(match)throw problem(`이미 공식 도감에 존재하는 조합입니다 (${match.formatted_number} ${match.display_name})`);
}
export const buildKey=items=>items.map(i=>`${i.ingredient_id}:${i.detail_id||0}@${i.ratio}`).sort().join('+');
async function digest(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function readBody(req){
  if(!req.headers.get('content-type')?.includes('application/json'))throw problem('JSON 요청 필요',415);
  const reader=req.body?.getReader();let length=0,chunks=[];
  if(!reader)throw problem('요청 내용 없음');
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>20000){await reader.cancel();throw problem('요청이 너무 큼',413);}chunks.push(value);}
  const bytes=new Uint8Array(length);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
  try{return JSON.parse(new TextDecoder().decode(bytes));}catch(_){throw problem('잘못된 JSON');}
}
async function actor(req,env,create=false){
  const match=req.headers.get('cookie')?.match(/(?:^|;\s*)ksool_session=([a-f0-9]{64})(?:;|$)/);
  if(match){const id=await digest(match[1]);if(await stmt(env,'SELECT id FROM sessions WHERE id=?',id).first())return {id,cookie:null};}
  if(!create)return {id:'',cookie:null};
  const token=[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
  const id=await digest(token);await stmt(env,'INSERT INTO sessions(id,created_at) VALUES(?,?)',id,now()).run();
  return {id,cookie:`ksool_session=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${new URL(req.url).protocol==='https:'?'; Secure':''}`};
}
async function limit(req,env,category,max){
  const windowStart=Math.floor(now()/60000)*60000;
  const ip=env.CLIENT_IP||req.headers.get('cf-connecting-ip')||'unknown';
  const key=`${category}:${await digest(ip)}:${windowStart}`;
  const result=await stmt(env,'INSERT INTO rate_limits(key,window_start,hits) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET hits=hits+1 RETURNING hits',key,windowStart).first();
  if(result.hits>max)throw problem('잠시 후 다시 시도',429);
}
async function countVotes(env,target,actorId){
  const row=await stmt(env,"SELECT COALESCE(SUM(direction='UP'),0) AS upvotes,COALESCE(SUM(direction='DOWN'),0) AS downvotes FROM votes WHERE target_key=?",target).first();
  const mine=actorId?await stmt(env,'SELECT direction FROM votes WHERE target_key=? AND actor_id=?',target,actorId).first():null;
  return {...row,myVote:mine?.direction||null};
}
const VALID_LANGS=new Set(['ko','en','ja','zh-CN','zh-TW','fr']);
function safeJsonObj(raw){try{const v=JSON.parse(raw||'{}');return v&&typeof v==='object'&&!Array.isArray(v)?v:{};}catch(_){return {};}}
function safeJsonArr(raw){try{const v=JSON.parse(raw||'[]');return Array.isArray(v)?v:[];}catch(_){return [];}}
function serializeAffiliate(row){
  return {
    id:row.id,
    enabled:Boolean(row.enabled),
    order:Number(row.sort_order)||0,
    locales:safeJsonArr(row.locales_json).filter(l=>VALID_LANGS.has(l)),
    icon:row.icon||'🛍️',
    url:row.url,
    name:safeJsonObj(row.name_json),
    badge:safeJsonObj(row.badge_json),
    desc:safeJsonObj(row.desc_json),
    disclosure:safeJsonObj(row.disclosure_json),
    updatedAt:row.updated_at
  };
}
function validateAffiliatePayload(b,overrideId=null){
  const id=str(overrideId||b.id,2,40,'제휴 ID').toLowerCase().replace(/[^a-z0-9_-]/g,'');
  if(!id||id.length<2)throw problem('제휴 ID는 영문·숫자·하이픈만 사용 가능합니다');
  const url=str(b.url,8,500,'제휴 URL');
  let parsedUrl;
  try{parsedUrl=new URL(url);}catch(_){throw problem('올바른 URL을 입력하세요');}
  if(!['https:','http:'].includes(parsedUrl.protocol))throw problem('http/https URL만 허용됩니다');
  const locales=(Array.isArray(b.locales)?b.locales:[]).map(x=>String(x).trim()).filter(l=>VALID_LANGS.has(l));
  if(!locales.length)throw problem('최소 1개 이상의 노출 언어를 선택하세요');
  const cleanMap=(m)=>{
    const out={};
    if(m&&typeof m==='object'){
      for(const [k,v] of Object.entries(m)){
        if(VALID_LANGS.has(k)&&typeof v==='string'&&v.trim())out[k]=v.trim().slice(0,400);
      }
    }
    return out;
  };
  const name=cleanMap(b.name);
  if(!Object.keys(name).length)throw problem('플랫폼 이름을 1개 이상 입력하세요');
  const disclosure=cleanMap(b.disclosure);
  if(!Object.keys(disclosure).length)throw problem('대가성 고지 문구(disclosure)를 1개 이상 입력하세요');
  return {
    id,
    enabled:b.enabled===undefined?1:(b.enabled?1:0),
    sort_order:Number.isFinite(Number(b.order))?Math.round(Number(b.order)):100,
    locales_json:JSON.stringify([...new Set(locales)]),
    icon:typeof b.icon==='string'&&b.icon.trim()?b.icon.trim().slice(0,8):'🛍️',
    url:parsedUrl.href,
    name_json:JSON.stringify(name),
    badge_json:JSON.stringify(cleanMap(b.badge)),
    desc_json:JSON.stringify(cleanMap(b.desc)),
    disclosure_json:JSON.stringify(disclosure)
  };
}
function normalizeLang(raw,sample=''){
  if(typeof raw==='string'&&VALID_LANGS.has(raw.trim()))return raw.trim();
  if(/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(sample))return 'ko';
  if(/[\u3040-\u30ff]/.test(sample))return 'ja';
  if(/[\u4e00-\u9fff]/.test(sample))return 'zh-CN';
  if(/[a-zA-Z]/.test(sample))return 'en';
  return 'ko';
}
function suggestionInsert(env,items,lang='ko'){return stmt(env,'INSERT OR IGNORE INTO suggestions(suggestion_key,items_json,lang,created_at) VALUES(?,?,?,?)',buildKey(items),JSON.stringify(items),normalizeLang(lang),now());}
function voteInsert(env,target,actorId,type){if(!['UP','DOWN'].includes(type))throw problem('UP 또는 DOWN 필요');return stmt(env,'INSERT INTO votes(target_key,actor_id,direction) VALUES(?,?,?) ON CONFLICT(target_key,actor_id) DO UPDATE SET direction=excluded.direction',target,actorId,type);}
async function suggestionList(env,actorId,url){
  const [beforeTime,beforeKey]=cursor(url.searchParams.get('before'));
  const available=url.searchParams.has('available')?new Set(url.searchParams.get('available').split(',').filter(Boolean).map(Number)):null;
  const langFilter=url.searchParams.get('lang');
  const hasLang=langFilter&&VALID_LANGS.has(langFilter);
  const {results}=await stmt(env,`SELECT s.*,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='UP') AS upvotes,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='DOWN') AS downvotes,m.direction AS my_vote FROM suggestions s LEFT JOIN votes m ON m.target_key=s.suggestion_key AND m.actor_id=? WHERE s.is_applied=0${hasLang?' AND COALESCE(s.lang,\'ko\')=?':''} AND (s.created_at<? OR (s.created_at=? AND s.suggestion_key<?)) ORDER BY s.created_at DESC,s.suggestion_key DESC LIMIT 201`,...(hasLang?[actorId,langFilter,beforeTime,beforeTime,beforeKey]:[actorId,beforeTime,beforeTime,beforeKey])).all();
  const page=results.slice(0,200);
  const userVotes={};
  const suggestions=page.map(s=>{if(s.my_vote)userVotes[s.suggestion_key]=s.my_vote;return {suggestion_key:s.suggestion_key,items:JSON.parse(s.items_json),lang:s.lang||'ko',upvotes:s.upvotes,downvotes:s.downvotes,is_applied:!!s.is_applied};}).filter(s=>!available||s.items.every(i=>available.has(i.ingredient_id)));
  suggestions.sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));
  return {suggestions,userVotes,nextBefore:results.length>200?`${page.at(-1).created_at}|${page.at(-1).suggestion_key}`:null};
}
const postSelect=`SELECT p.*,s.items_json,(SELECT COUNT(*) FROM votes v WHERE v.target_key=p.target_key AND v.direction='UP') AS upvotes,(SELECT COUNT(*) FROM votes v WHERE v.target_key=p.target_key AND v.direction='DOWN') AS downvotes,m.direction AS my_vote,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count FROM posts p LEFT JOIN suggestions s ON s.suggestion_key=p.suggestion_key LEFT JOIN votes m ON m.target_key=p.target_key AND m.actor_id=?`;
function serializePost(p,actorId){return {id:p.id,kind:p.kind,title:p.title,body:p.body,author:p.author,lang:p.lang||'ko',recipeId:p.recipe_id,suggestion_key:p.suggestion_key,items:p.items_json?JSON.parse(p.items_json):undefined,upvotes:p.upvotes,downvotes:p.downvotes,myVote:p.my_vote||null,commentCount:p.comment_count,createdAt:p.created_at,isMine:p.actor_id===actorId};}

const SUPABASE_URL='https://jyjxvwxlwkoedxwkkysj.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anh2d3hsd2tvZWR4d2treXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NzY5NDUsImV4cCI6MjEwOTA1Mjk0NX0.wfaRfya2PV4Ykawd6md4fXrO91_TWnyGyusSRa-2fJ8';
const ALL_ADMIN_PERMS=['posts','suggestions','updates','affiliates','prompt_gen'];
async function verifyAdminUser(req,env){
  const auth=req.headers.get('authorization')||'';
  const m=auth.match(/^Bearer\s+(.+)$/i);
  if(!m)return null;
  const token=m[1].trim();
  if(!token)return null;
  const allowedAdmins=new Set((env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  let user=null;
  if(typeof env.ADMIN_VERIFY_OVERRIDE==='function'){
    user=await env.ADMIN_VERIFY_OVERRIDE(token);
  }else{
    const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});
    if(res.ok)user=await res.json();
  }
  const email=user?.email?.trim().toLowerCase();
  if(!email)return null;
  if(allowedAdmins.has(email)){
    return {email,isSuperAdmin:true,permissions:[...ALL_ADMIN_PERMS,'roles']};
  }
  const roleRow=await stmt(env,'SELECT permissions_json FROM admin_roles WHERE email=?',email).first();
  if(!roleRow)return null;
  let perms=[];
  try{perms=JSON.parse(roleRow.permissions_json).filter(p=>ALL_ADMIN_PERMS.includes(p));}catch(_){}
  if(!perms.length)return null;
  return {email,isSuperAdmin:false,permissions:perms};
}
async function requireAdmin(req,env,perm=null){
  const user=await verifyAdminUser(req,env);
  if(!user)throw problem('관리자 권한이 필요합니다',403);
  if(perm&&!user.isSuperAdmin&&!user.permissions.includes(perm))throw problem('해당 관리 권한이 없습니다',403);
  return user;
}
async function buildAgentRecipePrompt(items,env){
  const nextId=Math.max(0,...catalog.recipes.map(r=>Number(r.recipe_id)||0))+1;
  const nextNum=Math.max(0,...catalog.recipes.map(r=>Number(r.recipe_number)||0))+1;
  const maxRatio=Math.max(...items.map(i=>i.ratio));
  const sumRatio=items.reduce((s,i)=>s+i.ratio,0);
  const hasDetail=items.some(i=>i.detail_id!=null);
  const suggestedStep=hasDetail?6:maxRatio>2?5:maxRatio===2?4:3;
  const difficulty=hasDetail?'MASTER':maxRatio===1?'EASY':'NORMAL';
  const ingLines=items.map((it,idx)=>{
    const base=ingredientMap.get(it.ingredient_id);
    const det=it.detail_id?detailMap.get(it.detail_id):null;
    return `- slot ${idx+1}: ${base?.display_name||it.ingredient_id} (ingredient_id: ${it.ingredient_id}${det?`, detail_ingredient_id: ${det.detail_id} (${det.display_name})`:''}) × ${it.ratio}`;
  }).join('\n');
  const fallbackPrompt=`[K-술 게임 신규 레시피 도감 편입 작업 요청]

아래 유저 추천 조합을 C:\\secjob\\KSool_Gemini 게임 프로젝트에 정식 레시피로 추가해 주세요.

1. 조합 정보
${ingLines}
- 총 재료 수: ${items.length}종 / 총 개수: ${sumRatio}개 / 최대 비율: ${maxRatio}
- 권장 난이도: ${difficulty} / 권장 스테이지: STAGE ${suggestedStep} (step_id: ${suggestedStep})
- 신규 ID 제안: recipe_id = ${nextId}, recipe_number = ${nextNum} (No.${String(nextNum).padStart(2,'0')})

2. 수정해야 할 파일 및 작업 체크리스트
- data/recipes.json: 신규 레시피 객체 추가 (display_name, real_name, difficulty: "${difficulty}", category, description, unlock_hint, emoji 등)
- data/recipe_ingredients.json: 위 slot 순서대로 ingredient_id, detail_ingredient_id, ratio, slot_order 추가
- src/js/core/ProgressionEngine.js: STAGE ${suggestedStep}의 canonicalRecipeOrder 배열 적절한 위치에 recipe_id(${nextId}) 추가
- src/js/services/PixelIconRegistry.js: rec:${nextId} 전용 SVG 픽셀/일러스트 아이콘 추가
- src/js/i18n/{ko,en,ja,zh-CN,zh-TW}.js: entities["rec:${nextId}"] 다국어 명칭 및 설명 추가
- 검증: node tests/test_full_suite.js 실행 후 통과 확인`;

  if(!env.GEMINI_API_KEY)return {prompt:fallbackPrompt,mode:'template'};
  try{
    const aiRes=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(env.GEMINI_API_KEY)}`,{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        contents:[{parts:[{text:`너는 'K-술: 한국의 술자리 연금술' 게임의 수석 기획자 겸 개발자야. 아래 유저 추천 재료 조합을 분석해서 개발 Agent에게 그대로 붙여넣을 수 있는 구체적인 작업 지시 프롬프트를 한국어로 작성해줘.

조합 정보:
${ingLines}
권장 난이도: ${difficulty}, 권장 STAGE: ${suggestedStep}, 신규 recipe_id: ${nextId}, recipe_number: ${nextNum}

반드시 포함할 내용:
1) 어울리는 위트있는 K-술 레시피 이름(한국어/영어/일본어/중국어), 카테고리, 1줄 설명, 스포일러 없는 힌트(unlock_hint)
2) data/recipes.json 및 data/recipe_ingredients.json 에 넣을 정확한 JSON 예시
3) ProgressionEngine.js(canonicalRecipeOrder 배치), PixelIconRegistry.js(아이콘 디자인 컨셉), i18n 다국어 파일 수정 지침
4) 테스트(node tests/test_full_suite.js) 실행 지침`}]}]
      })
    });
    if(aiRes.ok){
      const aiData=await aiRes.json();
      const text=aiData?.candidates?.[0]?.content?.parts?.[0]?.text;
      if(text&&text.trim())return {prompt:text.trim(),mode:'gemini'};
    }
  }catch(_){}
  return {prompt:fallbackPrompt,mode:'template'};
}

export async function handleApi(req,env){
  const url=new URL(req.url),path=url.pathname;
  const origin=req.headers.get('origin');
  const allowed=new Set((env.GAME_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
  const allowedOrigin=origin&&(origin===url.origin||allowed.has(origin));
  if(origin&&!allowedOrigin)return json({error:'허용되지 않은 출처'},403);
  const cors={'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,PUT,PATCH,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type,Authorization','Access-Control-Allow-Credentials':'true'};
  if(allowedOrigin)cors['Access-Control-Allow-Origin']=origin;
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
  let identity={id:'',cookie:null};
  let result;
  try{
    if(req.method==='GET'&&path==='/api/health')return json({ok:true,storage:env.STORAGE_LABEL||'Cloudflare D1',schemaVersion:1});
    const mutating=['POST','PUT','DELETE'].includes(req.method);
    if(mutating||path==='/api/session')await limit(req,env,'all',120);
    identity=await actor(req,env,mutating||path==='/api/session');
    if(req.method==='GET'&&path==='/api/session')result=json({ok:true,anonymous:true});
    else if(req.method==='GET'&&path==='/api/suggestions')result=json(await suggestionList(env,identity.id,url));
    else if(req.method==='POST'&&path==='/api/suggestions'){
      const body=await readBody(req);const items=normalizeItems(body.items||body.potSlots?.map(s=>({ingredient_id:s.baseId,detail_id:s.detailId||null,ratio:s.count})));
      const key=buildKey(items);ensureNotOfficialRecipe(key);
      const lang=normalizeLang(body.lang);
      await env.DB.batch([suggestionInsert(env,items,lang),voteInsert(env,key,identity.id,'UP')]);
      result=json({suggestion_key:key,items,lang,...await countVotes(env,key,identity.id),is_applied:false},201);
    }else if(req.method==='PUT'&&path==='/api/votes'){
      const body=await readBody(req);let target;
      const batch=[];
      if(body.items){const items=normalizeItems(body.items);target=buildKey(items);batch.push(suggestionInsert(env,items,body.lang));}
      else if(body.suggestion_key){target=str(body.suggestion_key,1,300,'조합');if(!await stmt(env,'SELECT suggestion_key FROM suggestions WHERE suggestion_key=?',target).first())throw problem('조합 없음',404);}
      else if(body.post_id){const post=await stmt(env,'SELECT target_key FROM posts WHERE id=? AND deleted_at IS NULL',body.post_id).first();if(!post)throw problem('글 없음',404);target=post.target_key;}
      else throw problem('조합 또는 글 필요');
      batch.push(voteInsert(env,target,identity.id,body.type));await env.DB.batch(batch);
      result=json({target_key:target,...await countVotes(env,target,identity.id)});
    }else if(req.method==='GET'&&path==='/api/posts'){
      const [beforeTime,beforeId]=cursor(url.searchParams.get('before'));
      const langFilter=url.searchParams.get('lang');
      const hasLang=langFilter&&VALID_LANGS.has(langFilter);
      const {results}=await stmt(env,`${postSelect} WHERE p.deleted_at IS NULL${hasLang?' AND COALESCE(p.lang,\'ko\')=?':''} AND (p.created_at<? OR (p.created_at=? AND p.id<?)) ORDER BY p.created_at DESC,p.id DESC LIMIT 101`,...(hasLang?[identity.id,langFilter,beforeTime,beforeTime,beforeId]:[identity.id,beforeTime,beforeTime,beforeId])).all();
      result=json({posts:results.slice(0,100).map(p=>serializePost(p,identity.id)),nextBefore:results.length>100?`${results[99].created_at}|${results[99].id}`:null});
    }else if(req.method==='POST'&&path==='/api/posts'){
      await limit(req,env,'posts',10);
      const b=await readBody(req),id=crypto.randomUUID(),time=now();
      if(!['tip','experiment'].includes(b.kind))throw problem('글 종류 확인');
      const title=str(b.title,1,70,'제목'),body=str(b.body,1,1500,'내용'),author=str(b.author,1,16,'닉네임');
      const lang=normalizeLang(b.lang,`${title} ${body}`);
      const recipeId=b.recipeId??null;if(recipeId!==null&&!recipeIds.has(recipeId))throw problem('공식 조합 확인');
      let key=null,batch=[];
      if(b.kind==='experiment'){const items=normalizeItems(b.items);key=buildKey(items);ensureNotOfficialRecipe(key);batch.push(suggestionInsert(env,items,lang));}
      const target=key||`post:${id}`;
      batch.push(stmt(env,'INSERT INTO posts(id,actor_id,kind,title,body,author,lang,recipe_id,suggestion_key,target_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,identity.id,b.kind,title,body,author,lang,recipeId,key,target,time));
      await env.DB.batch(batch);
      const row=await stmt(env,`${postSelect} WHERE p.id=?`,identity.id,id).first();
      result=json({post:serializePost(row,identity.id)},201);
    }else if(/^\/api\/posts\/[\w-]+$/.test(path)){
      const id=path.split('/').at(-1);
      if(req.method==='GET'){const row=await stmt(env,`${postSelect} WHERE p.id=? AND p.deleted_at IS NULL`,identity.id,id).first();if(!row)throw problem('글 없음',404);result=json({post:serializePost(row,identity.id)});}
      else if(req.method==='DELETE'){const post=await stmt(env,'SELECT actor_id FROM posts WHERE id=? AND deleted_at IS NULL',id).first();if(!post)throw problem('글 없음',404);if(post.actor_id!==identity.id)throw problem('내 글만 삭제 가능',403);await stmt(env,'UPDATE posts SET deleted_at=? WHERE id=?',now(),id).run();result=json({ok:true});}
      else throw problem('지원하지 않는 요청',405);
    }else if(/^\/api\/posts\/[\w-]+\/comments$/.test(path)){
      const id=path.split('/')[3];if(!await stmt(env,'SELECT id FROM posts WHERE id=? AND deleted_at IS NULL',id).first())throw problem('글 없음',404);
      if(req.method==='GET'){const {results}=await stmt(env,'SELECT id,author,body,COALESCE(lang,\'ko\') AS lang,created_at FROM comments WHERE post_id=? ORDER BY created_at,id LIMIT 200',id).all();result=json({comments:results});}
      else if(req.method==='POST'){await limit(req,env,'comments',30);const b=await readBody(req),cBody=str(b.body,1,500,'댓글'),cLang=normalizeLang(b.lang,cBody);await stmt(env,'INSERT INTO comments(id,post_id,actor_id,author,body,lang,created_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),id,identity.id,str(b.author,1,16,'닉네임'),cBody,cLang,now()).run();result=json({ok:true},201);}
      else throw problem('지원하지 않는 요청',405);
    }else if(req.method==='POST'&&path==='/api/reports'){
      const b=await readBody(req);if(!await stmt(env,'SELECT id FROM posts WHERE id=? AND deleted_at IS NULL',b.post_id).first())throw problem('글 없음',404);
      await stmt(env,'INSERT INTO reports(post_id,actor_id,reason,created_at) VALUES(?,?,?,?) ON CONFLICT(post_id,actor_id) DO UPDATE SET reason=excluded.reason',b.post_id,identity.id,str(b.reason,1,120,'신고 사유'),now()).run();result=json({ok:true});
    }else if(req.method==='GET'&&path==='/api/updates'){
      const {results}=await stmt(env,'SELECT id,version,date,title,body,created_at FROM updates ORDER BY created_at DESC LIMIT 30').all();
      result=json({updates:results});
    }else if(req.method==='GET'&&path==='/api/affiliates'){
      const langParam=url.searchParams.get('lang');
      const {results}=await stmt(env,'SELECT * FROM affiliate_partners WHERE enabled=1 ORDER BY sort_order ASC,id ASC').all();
      let partners=results.map(serializeAffiliate);
      if(langParam&&VALID_LANGS.has(langParam)){
        partners=partners.filter(p=>p.locales.includes(langParam));
      }
      result=json({partners});
    }else if(req.method==='GET'&&path==='/api/admin/me'){
      const user=await verifyAdminUser(req,env);
      result=json({isAdmin:Boolean(user),isSuperAdmin:Boolean(user?.isSuperAdmin),permissions:user?.permissions||[],email:user?.email||null});
    }else if(req.method==='GET'&&path==='/api/admin/overview'){
      const admin=await requireAdmin(req,env);
      const can=(p)=>admin.isSuperAdmin||admin.permissions.includes(p);
      const reports=can('posts')?(await stmt(env,`SELECT r.post_id,COUNT(*) AS report_count,MAX(r.created_at) AS latest_report,GROUP_CONCAT(r.reason,' | ') AS reasons,p.title,p.author,p.body,p.kind,p.created_at FROM reports r JOIN posts p ON p.id=r.post_id WHERE p.deleted_at IS NULL GROUP BY r.post_id ORDER BY report_count DESC,latest_report DESC LIMIT 50`).all()).results:[];
      const recentPosts=can('posts')?(await stmt(env,`${postSelect} WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 50`,identity.id).all()).results.map(p=>serializePost(p,identity.id)):[];
      const sugRows=can('suggestions')?(await stmt(env,`SELECT s.*,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='UP') AS upvotes,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='DOWN') AS downvotes FROM suggestions s ORDER BY s.created_at DESC LIMIT 100`).all()).results.map(s=>({suggestion_key:s.suggestion_key,items:JSON.parse(s.items_json),upvotes:s.upvotes,downvotes:s.downvotes,is_applied:!!s.is_applied,created_at:s.created_at})):[];
      const updates=can('updates')?(await stmt(env,'SELECT id,version,date,title,body,created_at FROM updates ORDER BY created_at DESC LIMIT 30').all()).results:[];
      const affiliates=(can('affiliates')||can('updates'))?(await stmt(env,'SELECT * FROM affiliate_partners ORDER BY sort_order ASC,id ASC').all()).results.map(serializeAffiliate):[];
      const roles=admin.isSuperAdmin?(await stmt(env,'SELECT email,permissions_json,added_by,created_at FROM admin_roles ORDER BY created_at DESC').all()).results.map(r=>({email:r.email,permissions:JSON.parse(r.permissions_json),added_by:r.added_by,created_at:r.created_at})):[];
      result=json({reports,posts:recentPosts,suggestions:sugRows,updates,affiliates,roles});
    }else if(req.method==='DELETE'&&/^\/api\/admin\/posts\/[\w-]+$/.test(path)){
      await requireAdmin(req,env,'posts');
      const id=path.split('/').at(-1);
      await stmt(env,'UPDATE posts SET deleted_at=? WHERE id=?',now(),id).run();
      result=json({ok:true});
    }else if(req.method==='DELETE'&&/^\/api\/admin\/comments\/[\w-]+$/.test(path)){
      await requireAdmin(req,env,'posts');
      const id=path.split('/').at(-1);
      await stmt(env,'DELETE FROM comments WHERE id=?',id).run();
      result=json({ok:true});
    }else if(req.method==='POST'&&/^\/api\/admin\/reports\/[\w-]+\/dismiss$/.test(path)){
      await requireAdmin(req,env,'posts');
      const postId=path.split('/')[4];
      await stmt(env,'DELETE FROM reports WHERE post_id=?',postId).run();
      result=json({ok:true});
    }else if(path.startsWith('/api/admin/suggestions/')){
      await requireAdmin(req,env,'suggestions');
      const key=decodeURIComponent(path.slice('/api/admin/suggestions/'.length));
      if(!key)throw problem('조합 키 필요');
      if(req.method==='PATCH'){
        const b=await readBody(req);
        await stmt(env,'UPDATE suggestions SET is_applied=? WHERE suggestion_key=?',b.is_applied?1:0,key).run();
        result=json({ok:true});
      }else if(req.method==='DELETE'){
        await env.DB.batch([
          stmt(env,'DELETE FROM votes WHERE target_key=?',key),
          stmt(env,'UPDATE posts SET suggestion_key=NULL WHERE suggestion_key=?',key),
          stmt(env,'DELETE FROM suggestions WHERE suggestion_key=?',key)
        ]);
        result=json({ok:true});
      }else throw problem('지원하지 않는 요청',405);
    }else if(req.method==='POST'&&path==='/api/admin/updates'){
      await requireAdmin(req,env,'updates');
      const b=await readBody(req);
      const id=crypto.randomUUID();
      await stmt(env,'INSERT INTO updates(id,version,date,title,body,created_at) VALUES(?,?,?,?,?,?)',id,str(b.version,1,20,'버전'),str(b.date,1,20,'날짜'),str(b.title,1,100,'제목'),str(b.body,1,1500,'내용'),now()).run();
      result=json({ok:true,id},201);
    }else if(req.method==='DELETE'&&/^\/api\/admin\/updates\/[\w-]+$/.test(path)){
      await requireAdmin(req,env,'updates');
      const id=path.split('/').at(-1);
      await stmt(env,'DELETE FROM updates WHERE id=?',id).run();
      result=json({ok:true});
    }else if(req.method==='POST'&&path==='/api/admin/affiliates'){
      await requireAdmin(req,env,'affiliates');
      const v=validateAffiliatePayload(await readBody(req));
      await stmt(env,'INSERT INTO affiliate_partners(id,enabled,sort_order,locales_json,icon,url,name_json,badge_json,desc_json,disclosure_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET enabled=excluded.enabled,sort_order=excluded.sort_order,locales_json=excluded.locales_json,icon=excluded.icon,url=excluded.url,name_json=excluded.name_json,badge_json=excluded.badge_json,desc_json=excluded.desc_json,disclosure_json=excluded.disclosure_json,updated_at=excluded.updated_at',v.id,v.enabled,v.sort_order,v.locales_json,v.icon,v.url,v.name_json,v.badge_json,v.desc_json,v.disclosure_json,now()).run();
      const row=await stmt(env,'SELECT * FROM affiliate_partners WHERE id=?',v.id).first();
      result=json({ok:true,partner:serializeAffiliate(row)},201);
    }else if(/^\/api\/admin\/affiliates\/[a-z0-9_-]+$/i.test(path)){
      await requireAdmin(req,env,'affiliates');
      const id=path.split('/').at(-1).toLowerCase();
      const existing=await stmt(env,'SELECT * FROM affiliate_partners WHERE id=?',id).first();
      if(!existing)throw problem('제휴 플랫폼을 찾을 수 없습니다',404);
      if(req.method==='PUT'||req.method==='PATCH'){
        const b=await readBody(req);
        const cur=serializeAffiliate(existing);
        const merged={
          id:cur.id,
          enabled:b.enabled!==undefined?b.enabled:cur.enabled,
          order:b.order!==undefined?b.order:cur.order,
          locales:b.locales!==undefined?b.locales:cur.locales,
          icon:b.icon!==undefined?b.icon:cur.icon,
          url:b.url!==undefined?b.url:cur.url,
          name:b.name!==undefined?b.name:cur.name,
          badge:b.badge!==undefined?b.badge:cur.badge,
          desc:b.desc!==undefined?b.desc:cur.desc,
          disclosure:b.disclosure!==undefined?b.disclosure:cur.disclosure
        };
        const v=validateAffiliatePayload(merged,id);
        await stmt(env,'UPDATE affiliate_partners SET enabled=?,sort_order=?,locales_json=?,icon=?,url=?,name_json=?,badge_json=?,desc_json=?,disclosure_json=?,updated_at=? WHERE id=?',v.enabled,v.sort_order,v.locales_json,v.icon,v.url,v.name_json,v.badge_json,v.desc_json,v.disclosure_json,now(),id).run();
        const updated=await stmt(env,'SELECT * FROM affiliate_partners WHERE id=?',id).first();
        result=json({ok:true,partner:serializeAffiliate(updated)});
      }else if(req.method==='DELETE'){
        await stmt(env,'DELETE FROM affiliate_partners WHERE id=?',id).run();
        result=json({ok:true});
      }else throw problem('지원하지 않는 요청',405);
    }else if(req.method==='POST'&&path==='/api/admin/roles'){
      const admin=await requireAdmin(req,env,'roles');
      const b=await readBody(req);
      const targetEmail=str(b.email,3,120,'이메일').toLowerCase();
      if(!targetEmail.includes('@'))throw problem('올바른 이메일을 입력하세요');
      const perms=(Array.isArray(b.permissions)?b.permissions:[]).filter(p=>ALL_ADMIN_PERMS.includes(p));
      if(!perms.length)throw problem('최소 1개 이상의 권한을 선택하세요');
      await stmt(env,'INSERT INTO admin_roles(email,permissions_json,added_by,created_at) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET permissions_json=excluded.permissions_json,added_by=excluded.added_by',targetEmail,JSON.stringify(perms),admin.email,now()).run();
      result=json({ok:true});
    }else if(req.method==='DELETE'&&path.startsWith('/api/admin/roles/')){
      await requireAdmin(req,env,'roles');
      const targetEmail=decodeURIComponent(path.slice('/api/admin/roles/'.length)).trim().toLowerCase();
      await stmt(env,'DELETE FROM admin_roles WHERE email=?',targetEmail).run();
      result=json({ok:true});
    }else if(req.method==='POST'&&path==='/api/admin/generate-recipe-prompt'){
      await requireAdmin(req,env,'prompt_gen');
      const b=await readBody(req);
      const items=normalizeItems(b.items);
      result=json(await buildAgentRecipePrompt(items,env));
    }else throw problem('경로 없음',404);
  }catch(error){if(!error.status)console.error('Community API:',error.message);result=json({error:error.status?error.message:'서버 오류'},error.status||500);}
  for(const [k,v]of Object.entries(cors))result.headers.set(k,v);
  if(identity.cookie)result.headers.set('Set-Cookie',identity.cookie);
  return result;
}
export default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env);return env.ASSETS.fetch(request);},async scheduled(event,env){await stmt(env,'DELETE FROM rate_limits WHERE window_start<?',now()-600000).run();}};

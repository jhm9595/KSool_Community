import catalog from './catalog.mjs';

const ingredientMap = new Map(catalog.ingredients.map(i=>[i.ingredient_id,i]));
const detailMap = new Map(catalog.details.map(i=>[i.detail_id,i]));
const recipeIds = new Set(catalog.recipes.map(r=>r.recipe_id));
const json = (data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const problem=(message,status=400)=>Object.assign(new Error(message),{status});
const str=(value,min,max,label)=>{if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)throw problem(`${label} 확인`);return value.trim();};
const stmt=(env,sql,...args)=>env.DB.prepare(sql).bind(...args);
const now=()=>Date.now();
const cursor=(raw)=>{if(!raw)return [Number.MAX_SAFE_INTEGER,'~'];const [time,...id]=raw.split('|');return [Number(time)||Number.MAX_SAFE_INTEGER,id.join('|')||'~'];};
export function normalizeItems(input){
  if(!Array.isArray(input)||input.length<2||input.length>10)throw problem('재료는 2종류 이상');
  const seen=new Set();
  const items=input.map(i=>{
    if(!i||!Number.isInteger(i.ingredient_id)||!ingredientMap.has(i.ingredient_id)||!Number.isInteger(i.ratio)||i.ratio<1||i.ratio>10)throw problem('재료·개수 확인');
    const detail=i.detail_id ?? i.detail_ingredient_id ?? null;
    if(detail!==null&&(!Number.isInteger(detail)||detailMap.get(detail)?.base_ingredient_id!==i.ingredient_id))throw problem('상세 재료 확인');
    const key=`${i.ingredient_id}:${detail||0}`;
    if(seen.has(key))throw problem('중복 재료');seen.add(key);
    return {ingredient_id:i.ingredient_id,detail_id:detail,ratio:i.ratio};
  });
  if(items.reduce((sum,i)=>sum+i.ratio,0)>10)throw problem('총 개수는 최대 10');
  return items;
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
function suggestionInsert(env,items){return stmt(env,'INSERT OR IGNORE INTO suggestions(suggestion_key,items_json,created_at) VALUES(?,?,?)',buildKey(items),JSON.stringify(items),now());}
function voteInsert(env,target,actorId,type){if(!['UP','DOWN'].includes(type))throw problem('UP 또는 DOWN 필요');return stmt(env,'INSERT INTO votes(target_key,actor_id,direction) VALUES(?,?,?) ON CONFLICT(target_key,actor_id) DO UPDATE SET direction=excluded.direction',target,actorId,type);}
async function suggestionList(env,actorId,url){
  const [beforeTime,beforeKey]=cursor(url.searchParams.get('before'));
  const available=url.searchParams.has('available')?new Set(url.searchParams.get('available').split(',').filter(Boolean).map(Number)):null;
  const {results}=await stmt(env,`SELECT s.*,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='UP') AS upvotes,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='DOWN') AS downvotes,m.direction AS my_vote FROM suggestions s LEFT JOIN votes m ON m.target_key=s.suggestion_key AND m.actor_id=? WHERE s.is_applied=0 AND (s.created_at<? OR (s.created_at=? AND s.suggestion_key<?)) ORDER BY s.created_at DESC,s.suggestion_key DESC LIMIT 201`,actorId,beforeTime,beforeTime,beforeKey).all();
  const page=results.slice(0,200);
  const userVotes={};
  const suggestions=page.map(s=>{if(s.my_vote)userVotes[s.suggestion_key]=s.my_vote;return {suggestion_key:s.suggestion_key,items:JSON.parse(s.items_json),upvotes:s.upvotes,downvotes:s.downvotes,is_applied:!!s.is_applied};}).filter(s=>!available||s.items.every(i=>available.has(i.ingredient_id)));
  suggestions.sort((a,b)=>(b.upvotes-b.downvotes)-(a.upvotes-a.downvotes));
  return {suggestions,userVotes,nextBefore:results.length>200?`${page.at(-1).created_at}|${page.at(-1).suggestion_key}`:null};
}
const postSelect=`SELECT p.*,s.items_json,(SELECT COUNT(*) FROM votes v WHERE v.target_key=p.target_key AND v.direction='UP') AS upvotes,(SELECT COUNT(*) FROM votes v WHERE v.target_key=p.target_key AND v.direction='DOWN') AS downvotes,m.direction AS my_vote,(SELECT COUNT(*) FROM comments c WHERE c.post_id=p.id) AS comment_count FROM posts p LEFT JOIN suggestions s ON s.suggestion_key=p.suggestion_key LEFT JOIN votes m ON m.target_key=p.target_key AND m.actor_id=?`;
function serializePost(p,actorId){return {id:p.id,kind:p.kind,title:p.title,body:p.body,author:p.author,recipeId:p.recipe_id,suggestion_key:p.suggestion_key,items:p.items_json?JSON.parse(p.items_json):undefined,upvotes:p.upvotes,downvotes:p.downvotes,myVote:p.my_vote||null,commentCount:p.comment_count,createdAt:p.created_at,isMine:p.actor_id===actorId};}

const SUPABASE_URL='https://jyjxvwxlwkoedxwkkysj.supabase.co';
const SUPABASE_ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anh2d3hsd2tvZWR4d2treXNqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NzY5NDUsImV4cCI6MjEwOTA1Mjk0NX0.wfaRfya2PV4Ykawd6md4fXrO91_TWnyGyusSRa-2fJ8';
async function verifyAdminUser(req,env){
  const auth=req.headers.get('authorization')||'';
  const m=auth.match(/^Bearer\s+(.+)$/i);
  if(!m)return null;
  const token=m[1].trim();
  if(!token)return null;
  const allowedAdmins=new Set((env.ADMIN_EMAILS||'jhm9595@gmail.com').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  if(typeof env.ADMIN_VERIFY_OVERRIDE==='function'){
    const u=await env.ADMIN_VERIFY_OVERRIDE(token);
    return u&&u.email&&allowedAdmins.has(u.email.toLowerCase())?u:null;
  }
  const res=await fetch(`${SUPABASE_URL}/auth/v1/user`,{headers:{apikey:SUPABASE_ANON_KEY,Authorization:`Bearer ${token}`}});
  if(!res.ok)return null;
  const user=await res.json();
  if(!user?.email||!allowedAdmins.has(user.email.toLowerCase()))return null;
  return user;
}
async function requireAdmin(req,env){
  const user=await verifyAdminUser(req,env);
  if(!user)throw problem('관리자 권한이 필요합니다',403);
  return user;
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
      const key=buildKey(items);
      await env.DB.batch([suggestionInsert(env,items),voteInsert(env,key,identity.id,'UP')]);
      result=json({suggestion_key:key,items,...await countVotes(env,key,identity.id),is_applied:false},201);
    }else if(req.method==='PUT'&&path==='/api/votes'){
      const body=await readBody(req);let target;
      const batch=[];
      if(body.items){const items=normalizeItems(body.items);target=buildKey(items);batch.push(suggestionInsert(env,items));}
      else if(body.suggestion_key){target=str(body.suggestion_key,1,300,'조합');if(!await stmt(env,'SELECT suggestion_key FROM suggestions WHERE suggestion_key=?',target).first())throw problem('조합 없음',404);}
      else if(body.post_id){const post=await stmt(env,'SELECT target_key FROM posts WHERE id=? AND deleted_at IS NULL',body.post_id).first();if(!post)throw problem('글 없음',404);target=post.target_key;}
      else throw problem('조합 또는 글 필요');
      batch.push(voteInsert(env,target,identity.id,body.type));await env.DB.batch(batch);
      result=json({target_key:target,...await countVotes(env,target,identity.id)});
    }else if(req.method==='GET'&&path==='/api/posts'){
      const [beforeTime,beforeId]=cursor(url.searchParams.get('before'));
      const {results}=await stmt(env,`${postSelect} WHERE p.deleted_at IS NULL AND (p.created_at<? OR (p.created_at=? AND p.id<?)) ORDER BY p.created_at DESC,p.id DESC LIMIT 101`,identity.id,beforeTime,beforeTime,beforeId).all();
      result=json({posts:results.slice(0,100).map(p=>serializePost(p,identity.id)),nextBefore:results.length>100?`${results[99].created_at}|${results[99].id}`:null});
    }else if(req.method==='POST'&&path==='/api/posts'){
      await limit(req,env,'posts',10);
      const b=await readBody(req),id=crypto.randomUUID(),time=now();
      if(!['tip','experiment'].includes(b.kind))throw problem('글 종류 확인');
      const title=str(b.title,1,70,'제목'),body=str(b.body,1,1500,'내용'),author=str(b.author,1,16,'닉네임');
      const recipeId=b.recipeId??null;if(recipeId!==null&&!recipeIds.has(recipeId))throw problem('공식 조합 확인');
      let key=null,batch=[];
      if(b.kind==='experiment'){const items=normalizeItems(b.items);key=buildKey(items);batch.push(suggestionInsert(env,items));}
      const target=key||`post:${id}`;
      batch.push(stmt(env,'INSERT INTO posts(id,actor_id,kind,title,body,author,recipe_id,suggestion_key,target_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)',id,identity.id,b.kind,title,body,author,recipeId,key,target,time));
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
      if(req.method==='GET'){const {results}=await stmt(env,'SELECT id,author,body,created_at FROM comments WHERE post_id=? ORDER BY created_at,id LIMIT 200',id).all();result=json({comments:results});}
      else if(req.method==='POST'){await limit(req,env,'comments',30);const b=await readBody(req);await stmt(env,'INSERT INTO comments(id,post_id,actor_id,author,body,created_at) VALUES(?,?,?,?,?,?)',crypto.randomUUID(),id,identity.id,str(b.author,1,16,'닉네임'),str(b.body,1,500,'댓글'),now()).run();result=json({ok:true},201);}
      else throw problem('지원하지 않는 요청',405);
    }else if(req.method==='POST'&&path==='/api/reports'){
      const b=await readBody(req);if(!await stmt(env,'SELECT id FROM posts WHERE id=? AND deleted_at IS NULL',b.post_id).first())throw problem('글 없음',404);
      await stmt(env,'INSERT INTO reports(post_id,actor_id,reason,created_at) VALUES(?,?,?,?) ON CONFLICT(post_id,actor_id) DO UPDATE SET reason=excluded.reason',b.post_id,identity.id,str(b.reason,1,120,'신고 사유'),now()).run();result=json({ok:true});
    }else if(req.method==='GET'&&path==='/api/updates'){
      const {results}=await stmt(env,'SELECT id,version,date,title,body,created_at FROM updates ORDER BY created_at DESC LIMIT 30').all();
      result=json({updates:results});
    }else if(req.method==='GET'&&path==='/api/admin/me'){
      const user=await verifyAdminUser(req,env);
      result=json({isAdmin:Boolean(user),email:user?.email||null});
    }else if(req.method==='GET'&&path==='/api/admin/overview'){
      await requireAdmin(req,env);
      const reports=(await stmt(env,`SELECT r.post_id,COUNT(*) AS report_count,MAX(r.created_at) AS latest_report,GROUP_CONCAT(r.reason,' | ') AS reasons,p.title,p.author,p.body,p.kind,p.created_at FROM reports r JOIN posts p ON p.id=r.post_id WHERE p.deleted_at IS NULL GROUP BY r.post_id ORDER BY report_count DESC,latest_report DESC LIMIT 50`).all()).results;
      const recentPosts=(await stmt(env,`${postSelect} WHERE p.deleted_at IS NULL ORDER BY p.created_at DESC LIMIT 50`,identity.id).all()).results.map(p=>serializePost(p,identity.id));
      const sugRows=(await stmt(env,`SELECT s.*,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='UP') AS upvotes,(SELECT COUNT(*) FROM votes v WHERE v.target_key=s.suggestion_key AND v.direction='DOWN') AS downvotes FROM suggestions s ORDER BY s.created_at DESC LIMIT 100`).all()).results.map(s=>({suggestion_key:s.suggestion_key,items:JSON.parse(s.items_json),upvotes:s.upvotes,downvotes:s.downvotes,is_applied:!!s.is_applied,created_at:s.created_at}));
      const updates=(await stmt(env,'SELECT id,version,date,title,body,created_at FROM updates ORDER BY created_at DESC LIMIT 30').all()).results;
      result=json({reports,posts:recentPosts,suggestions:sugRows,updates});
    }else if(req.method==='DELETE'&&/^\/api\/admin\/posts\/[\w-]+$/.test(path)){
      await requireAdmin(req,env);
      const id=path.split('/').at(-1);
      await stmt(env,'UPDATE posts SET deleted_at=? WHERE id=?',now(),id).run();
      result=json({ok:true});
    }else if(req.method==='DELETE'&&/^\/api\/admin\/comments\/[\w-]+$/.test(path)){
      await requireAdmin(req,env);
      const id=path.split('/').at(-1);
      await stmt(env,'DELETE FROM comments WHERE id=?',id).run();
      result=json({ok:true});
    }else if(req.method==='POST'&&/^\/api\/admin\/reports\/[\w-]+\/dismiss$/.test(path)){
      await requireAdmin(req,env);
      const postId=path.split('/')[4];
      await stmt(env,'DELETE FROM reports WHERE post_id=?',postId).run();
      result=json({ok:true});
    }else if(path.startsWith('/api/admin/suggestions/')){
      await requireAdmin(req,env);
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
      await requireAdmin(req,env);
      const b=await readBody(req);
      const id=crypto.randomUUID();
      await stmt(env,'INSERT INTO updates(id,version,date,title,body,created_at) VALUES(?,?,?,?,?,?)',id,str(b.version,1,20,'버전'),str(b.date,1,20,'날짜'),str(b.title,1,100,'제목'),str(b.body,1,1500,'내용'),now()).run();
      result=json({ok:true,id},201);
    }else if(req.method==='DELETE'&&/^\/api\/admin\/updates\/[\w-]+$/.test(path)){
      await requireAdmin(req,env);
      const id=path.split('/').at(-1);
      await stmt(env,'DELETE FROM updates WHERE id=?',id).run();
      result=json({ok:true});
    }else throw problem('경로 없음',404);
  }catch(error){if(!error.status)console.error('Community API:',error.message);result=json({error:error.status?error.message:'서버 오류'},error.status||500);}
  for(const [k,v]of Object.entries(cors))result.headers.set(k,v);
  if(identity.cookie)result.headers.set('Set-Cookie',identity.cookie);
  return result;
}
export default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env);return env.ASSETS.fetch(request);},async scheduled(event,env){await stmt(env,'DELETE FROM rate_limits WHERE window_start<?',now()-600000).run();}};

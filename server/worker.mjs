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

export async function handleApi(req,env){
  const url=new URL(req.url),path=url.pathname;
  const origin=req.headers.get('origin');
  const allowed=new Set((env.GAME_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean));
  const allowedOrigin=origin&&(origin===url.origin||allowed.has(origin));
  if(origin&&!allowedOrigin)return json({error:'허용되지 않은 출처'},403);
  const cors={'Vary':'Origin','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type','Access-Control-Allow-Credentials':'true'};
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
    }else throw problem('경로 없음',404);
  }catch(error){if(!error.status)console.error('Community API:',error.message);result=json({error:error.status?error.message:'서버 오류'},error.status||500);}
  for(const [k,v]of Object.entries(cors))result.headers.set(k,v);
  if(identity.cookie)result.headers.set('Set-Cookie',identity.cookie);
  return result;
}
export default {async fetch(request,env){if(new URL(request.url).pathname.startsWith('/api/'))return handleApi(request,env);return env.ASSETS.fetch(request);},async scheduled(event,env){await stmt(env,'DELETE FROM rate_limits WHERE window_start<?',now()-600000).run();}};

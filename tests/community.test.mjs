import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { handleApi,buildKey,normalizeItems } from '../server/worker.mjs';
import { openDatabase } from '../server/sqlite.mjs';
import { GameSuggestionClient } from '../integration/GameSuggestionClient.mjs';
const combo=[{ingredient_id:101,detail_id:null,ratio:2},{ingredient_id:102,detail_id:null,ratio:1}];
function harness(DB){let cookie='';return {async call(path,method='GET',body){const req=new Request('http://localhost:8766/api'+path,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});const res=await handleApi(req,{DB,CLIENT_IP:crypto.randomUUID()});if(res.headers.get('set-cookie'))cookie=res.headers.get('set-cookie').split(';')[0];return {status:res.status,data:await res.json()};},async fetcher(url,opts={}){const p=new URL(url).pathname.replace('/api','')+new URL(url).search;const result=await this.call(p,opts.method||'GET',opts.body?JSON.parse(opts.body):undefined);return new Response(JSON.stringify(result.data),{status:result.status});}};}
test('key matches the game string sorting, ratios and detail IDs',()=>{
  assert.equal(buildKey(normalizeItems(combo)),'101:0@2+102:0@1');
  assert.equal(buildKey(normalizeItems([...combo].reverse())),buildKey(combo));
  assert.throws(()=>normalizeItems([{ingredient_id:101,ratio:9},{ingredient_id:102,ratio:9}]));
  assert.throws(()=>normalizeItems([{ingredient_id:101,detail_id:50201,ratio:1},{ingredient_id:102,ratio:1}]));
});
test('two browsers share posts, comments and one vote per browser; game adapter sees same counters',async()=>{
  const db=openDatabase(':memory:'),a=harness(db),b=harness(db);
  try{
    const created=await a.call('/posts','POST',{kind:'experiment',title:'새 비율',body:'조합 확인',author:'A',items:combo});assert.equal(created.status,201);
    const post=created.data.post,key=post.suggestion_key;
    assert.equal((await b.call('/posts')).data.posts[0].id,post.id);
    await a.call('/votes','PUT',{post_id:post.id,type:'UP'});
    await a.call('/votes','PUT',{suggestion_key:key,type:'UP'});
    let snapshot=(await b.call('/suggestions')).data;assert.equal(snapshot.suggestions[0].upvotes,1);
    await b.call('/votes','PUT',{suggestion_key:key,type:'DOWN'});
    snapshot=(await b.call('/suggestions')).data;assert.equal(snapshot.suggestions[0].downvotes,1);assert.equal(snapshot.userVotes[key],'DOWN');
    await a.call('/votes','PUT',{suggestion_key:key,type:'DOWN'});
    snapshot=(await a.call('/suggestions')).data;assert.equal(snapshot.suggestions[0].upvotes,0);assert.equal(snapshot.suggestions[0].downvotes,2);
    const other=await b.call('/posts','POST',{kind:'experiment',title:'같은 조합',body:'다른 설명',author:'B',items:[...combo].reverse()});assert.equal(other.data.post.suggestion_key,key);assert.equal(other.data.post.downvotes,2);
    assert.equal((await b.call(`/posts/${post.id}/comments`,'POST',{author:'B',body:'함께 확인해요'})).status,201);
    assert.equal((await a.call(`/posts/${post.id}/comments`)).data.comments.length,1);
    assert.equal((await b.call(`/posts/${post.id}`,'DELETE')).status,403);
    assert.equal((await a.call('/suggestions?available=101')).data.suggestions.length,0);
    assert.equal((await a.call('/suggestions?available=101,102')).data.suggestions.length,1);
    const adapter=new GameSuggestionClient('http://localhost:8766',{fetcher:a.fetcher.bind(a),inventory:{isIngredientAvailable:()=>true}});await adapter.init();assert.equal(adapter.getActiveSuggestions()[0].downvotes,2);
    await adapter.vote(key,'UP');assert.equal(adapter.exportGameSnapshot().suggestions[0].upvotes,1);
    const front=(await b.call('/posts')).data.posts.find(p=>p.id===post.id);assert.equal(front.upvotes,1);assert.equal(front.downvotes,1);
    await a.call(`/posts/${post.id}`,'DELETE');assert.equal((await b.call(`/posts/${post.id}`)).status,404);
  }finally{db.close();}
});
test('SQLite survives restart; forged counters and cross-origin writes are rejected or ignored',async()=>{
  const dir=mkdtempSync(join(tmpdir(),'ksool-test-')),path=join(dir,'test.sqlite');let db=openDatabase(path);
  try{
    const a=harness(db);const r=await a.call('/suggestions','POST',{items:combo,upvotes:9999,downvotes:9999,is_applied:true});assert.equal(r.status,201);assert.equal(r.data.upvotes,1);assert.equal(r.data.downvotes,0);assert.equal(r.data.is_applied,false);
    db.close();db=openDatabase(path);assert.equal((await harness(db).call('/suggestions')).data.suggestions[0].upvotes,1);
    const foreign=await handleApi(new Request('http://localhost:8766/api/posts',{method:'POST',headers:{origin:'https://untrusted.example','content-type':'application/json'},body:'{}'}),{DB:db});assert.equal(foreign.status,403);
    assert.equal((await harness(db).call('/posts','POST',{kind:'tip',title:' ',body:'text',author:'A'})).status,400);
  }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});
test('cursor pagination keeps records with identical timestamps',async()=>{
  const db=openDatabase(':memory:');
  try{
    await db.prepare('INSERT INTO sessions(id,created_at) VALUES(?,?)').bind('pagination-actor',1).run();
    await db.batch(Array.from({length:102},(_,i)=>db.prepare('INSERT INTO posts(id,actor_id,kind,title,body,author,target_key,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(`item${String(i).padStart(3,'0')}`,'pagination-actor','tip','test','body','A',`post:item${i}`,12345)));
    const a=harness(db),first=(await a.call('/posts')).data;
    assert.equal(first.posts.length,100);assert.ok(first.nextBefore);
    const second=(await a.call('/posts?before='+encodeURIComponent(first.nextBefore))).data;
    assert.equal(second.posts.length,2);assert.equal(second.nextBefore,null);
    assert.equal(new Set([...first.posts,...second.posts].map(p=>p.id)).size,102);
  }finally{db.close();}
});

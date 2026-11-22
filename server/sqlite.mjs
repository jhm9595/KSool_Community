import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdirSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_AFFILIATE_PARTNERS } from './default-affiliates.mjs';

export function openDatabase(path){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const sqlite=new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const migDir=fileURLToPath(new URL('../migrations/',import.meta.url));
  for(const file of readdirSync(migDir).filter(f=>f.endsWith('.sql')).sort()){
    sqlite.exec(readFileSync(join(migDir,file),'utf8').replace(/^\uFEFF/,''));
  }
  for(const tbl of ['posts','suggestions','comments']){
    try{sqlite.exec(`ALTER TABLE ${tbl} ADD COLUMN lang TEXT NOT NULL DEFAULT 'ko';`);}catch(_){}
  }
  const affCount=sqlite.prepare('SELECT COUNT(*) AS cnt FROM affiliate_partners').get()?.cnt||0;
  if(affCount===0){
    const ins=sqlite.prepare('INSERT INTO affiliate_partners(id,enabled,sort_order,locales_json,icon,url,name_json,badge_json,desc_json,disclosure_json,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)');
    const ts=Date.now();
    for(const p of DEFAULT_AFFILIATE_PARTNERS){
      ins.run(p.id,p.enabled?1:0,p.order,JSON.stringify(p.locales),p.icon||'🛍️',p.url,JSON.stringify(p.name||{}),JSON.stringify(p.badge||{}),JSON.stringify(p.desc||{}),JSON.stringify(p.disclosure||{}),ts);
    }
  }else{
    const upd=sqlite.prepare('UPDATE affiliate_partners SET locales_json=?,url=?,desc_json=?,disclosure_json=?,updated_at=? WHERE id=? AND url LIKE ?');
    const ts=Date.now();
    for(const id of ['amazon-us','amazon-jp','amazon-global']){
      const p=DEFAULT_AFFILIATE_PARTNERS.find(x=>x.id===id);
      if(p)upd.run(JSON.stringify(p.locales),p.url,JSON.stringify(p.desc||{}),JSON.stringify(p.disclosure||{}),ts,id,'%/s?k=%');
    }
  }
  function statement(sql,args=[]){
    return {sql,args,bind(...values){return statement(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};
  }
  return {prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>({success:true,meta:{changes:Number(sqlite.prepare(s.sql).run(...s.args).changes)}}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}};
}

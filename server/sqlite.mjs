import { DatabaseSync } from 'node:sqlite';
import { readFileSync,mkdirSync,readdirSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

export function openDatabase(path){
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const sqlite=new DatabaseSync(path);
  sqlite.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  const migDir=fileURLToPath(new URL('../migrations/',import.meta.url));
  for(const file of readdirSync(migDir).filter(f=>f.endsWith('.sql')).sort()){
    sqlite.exec(readFileSync(join(migDir,file),'utf8').replace(/^\uFEFF/,''));
  }
  function statement(sql,args=[]){
    return {sql,args,bind(...values){return statement(sql,values);},async first(){return sqlite.prepare(sql).get(...args)||null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){const r=sqlite.prepare(sql).run(...args);return {success:true,meta:{changes:Number(r.changes)}};}};
  }
  return {prepare:sql=>statement(sql),async batch(statements){sqlite.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>({success:true,meta:{changes:Number(sqlite.prepare(s.sql).run(...s.args).changes)}}));sqlite.exec('COMMIT');return results;}catch(e){sqlite.exec('ROLLBACK');throw e;}},close(){sqlite.close();}};
}

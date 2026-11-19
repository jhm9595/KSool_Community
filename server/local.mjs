import { createServer } from 'node:http';
import { readFile,stat } from 'node:fs/promises';
import { resolve,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './worker.mjs';
import { openDatabase } from './sqlite.mjs';
const root=resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const port=Number(process.env.PORT||8766);
const listenHost=process.env.HOST||(process.env.K_SERVICE?'0.0.0.0':'127.0.0.1');
const db=openDatabase(process.env.DB_PATH||fileURLToPath(new URL('../.data/community.sqlite',import.meta.url)));
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.json':'application/json; charset=utf-8','.txt':'text/plain; charset=utf-8','.xml':'application/xml; charset=utf-8'};
const isAllowedHost=(host)=>{
  if(!host)return false;
  if([`localhost:${port}`,`127.0.0.1:${port}`].includes(host))return true;
  if(process.env.K_SERVICE||process.env.ALLOW_ANY_HOST==='1'){
    const hostname=host.split(':')[0].toLowerCase();
    return hostname==='ksool.minibig.pw'||hostname.endsWith('.minibig.pw')||hostname.endsWith('.run.app')||hostname==='localhost'||hostname==='127.0.0.1';
  }
  return false;
};
const server=createServer(async(req,res)=>{
  try{
    const host=req.headers.host;
    if(!isAllowedHost(host)){res.writeHead(403);res.end('Invalid host');return;}
    const proto=req.headers['x-forwarded-proto']==='https'?'https':'http';
    const url=new URL(req.url,`${proto}://${host}`);
    if(url.pathname.startsWith('/api/')){
      let body,bytes=0,chunks=[];
      if(!['GET','HEAD','OPTIONS'].includes(req.method)){
        for await(const chunk of req){bytes+=chunk.length;if(bytes>20000){res.writeHead(413);res.end('Too large');return;}chunks.push(chunk);}body=Buffer.concat(chunks);
      }
      const request=new Request(url,{method:req.method,headers:req.headers,body});
      const clientIp=String(req.headers['x-forwarded-for']||'').split(',')[0].trim()||req.socket.remoteAddress;
      const response=await handleApi(request,{DB:db,STORAGE_LABEL:process.env.K_SERVICE?'Cloud Run SQLite':'SQLite local',CLIENT_IP:clientIp,GAME_ORIGINS:process.env.GAME_ORIGINS||'https://ksool.minibig.pw,https://play.ksool.minibig.pw',ADMIN_EMAILS:process.env.ADMIN_EMAILS||'',GEMINI_API_KEY:process.env.GEMINI_API_KEY||''});
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
    const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
    if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
    const info=await stat(path);if(!info.isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Referrer-Policy':'strict-origin-when-cross-origin'});
    res.end(req.method==='HEAD'?undefined:await readFile(path));
  }catch(error){if(error.code==='ENOENT'){res.writeHead(404);res.end('Not found');}else{console.error(error.message);res.writeHead(500);res.end('Server error');}}
});
server.listen(port,listenHost,()=>console.log(`Community: http://${listenHost}:${port} (persistent SQLite)`));
setInterval(()=>db.prepare('DELETE FROM rate_limits WHERE window_start<?').bind(Date.now()-600000).run().catch(console.error),600000).unref();
function shutdown(){server.close(()=>{db.close();process.exit(0);});}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);

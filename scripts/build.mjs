import { mkdir,copyFile,cp } from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const file of ['index.html','styles.css','neo.css','app.js','progress-protocol.js','game-dock.js','privacy.html','terms.html','about.html','robots.txt','sitemap.xml','ads.txt'])await copyFile(new URL(file,root),new URL(file,dist));
await cp(new URL('assets/',root),new URL('assets/',dist),{recursive:true});
await cp(new URL('admin-analytics/',root),new URL('admin-analytics/',dist),{recursive:true});
console.log('Static assets prepared in dist/');

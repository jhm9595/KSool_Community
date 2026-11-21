import { mkdir,copyFile,cp,readFile,writeFile } from 'node:fs/promises';
const root=new URL('../',import.meta.url),dist=new URL('../dist/',import.meta.url);
await mkdir(dist,{recursive:true});
for(const file of ['index.html','styles.css','neo.css','app.js','progress-protocol.js','game-dock.js','privacy.html','terms.html','about.html','robots.txt','sitemap.xml','ads.txt'])await copyFile(new URL(file,root),new URL(file,dist));
await cp(new URL('assets/',root),new URL('assets/',dist),{recursive:true});
await cp(new URL('admin-analytics/',root),new URL('admin-analytics/',dist),{recursive:true});
try {
  const gd = await readFile(new URL('assets/game-data.js', root), 'utf8');
  const parsed = JSON.parse(gd.replace(/^window\.GAME_DATA\s*=\s*/, '').replace(/;?\s*$/, ''));
  const total = Array.isArray(parsed?.recipes) ? parsed.recipes.length : 0;
  if (total > 0) {
    const htmlPath = new URL('index.html', dist);
    const html = await readFile(htmlPath, 'utf8');
    await writeFile(htmlPath, html.replace(/(<b id="recipe-total">)\d+(<\/b>)/, `$1${total}$2`), 'utf8');
  }
} catch (_) {}
console.log('Static assets prepared in dist/');

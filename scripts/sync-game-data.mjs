import { existsSync } from 'node:fs';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const target = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = resolve(process.argv[2] || resolve(target, '../KSool_Gemini'));

if (source === target || source.startsWith(target + '/')) {
  throw new Error('Source must be the separate game project');
}

if (!existsSync(resolve(source, 'data/recipes.json'))) {
  console.log('[sync-game-data] ../KSool_Gemini not found; using existing synced assets.');
  process.exit(0);
}

const bundle = {};
for (const name of ['recipes', 'recipe_ingredients', 'ingredients_base', 'ingredients_detail', 'categories']) {
  bundle[name] = JSON.parse(
    (await readFile(resolve(source, 'data', `${name}.json`), 'utf8')).replace(/^\uFEFF/, '')
  );
}

const context = { window: { KSool: {} } };
vm.createContext(context);
for (const file of ['src/js/core/ProgressionEngine.js', 'src/js/core/RecipeBook.js']) {
  vm.runInContext(await readFile(resolve(source, file), 'utf8'), context);
}

const book = new context.window.KSool.RecipeBook();
book.load(bundle);
bundle.recipes = book.getAllRecipes();
bundle.free_starter_ids = book.progression?.freeStarterLeafIds || [202, 206, 205, 701, 301];

await writeFile(resolve(target, 'assets/game-data.js'), `window.GAME_DATA = ${JSON.stringify(bundle)};`, 'utf8');
await writeFile(
  resolve(target, 'server/catalog.mjs'),
  `export default ${JSON.stringify({
    ingredients: bundle.ingredients_base,
    details: bundle.ingredients_detail,
    recipes: bundle.recipes,
    recipe_ingredients: bundle.recipe_ingredients
  })};`,
  'utf8'
);
await copyFile(resolve(source, 'src/js/services/PixelIconRegistry.js'), resolve(target, 'assets/game-icons.js'));
for (const assetFile of ['app_logo.png', 'favicon-32x32.png', 'favicon.png', 'app_icon_192.png']) {
  const srcAsset = resolve(source, 'assets', assetFile);
  if (existsSync(srcAsset)) await copyFile(srcAsset, resolve(target, 'assets', assetFile));
}

// 게임의 다국어(i18n) 및 블로그/어필리에이트 링크 설정도 게임 프로젝트 기준으로 단일 동기화
const i18nContext = { window: { KSool: { I18N_LOCALES: {} } } };
vm.createContext(i18nContext);
for (const langFile of ['ko.js', 'en.js', 'ja.js', 'zh-CN.js', 'zh-TW.js']) {
  const fullPath = resolve(source, 'src/js/i18n', langFile);
  if (existsSync(fullPath)) {
    vm.runInContext(await readFile(fullPath, 'utf8'), i18nContext);
  }
}
await writeFile(
  resolve(target, 'assets/game-i18n.js'),
  `window.GAME_I18N = ${JSON.stringify(i18nContext.window.KSool.I18N_LOCALES)};`,
  'utf8'
);

const linksContext = { window: { KSool: {} } };
vm.createContext(linksContext);
for (const cfgFile of ['affiliate_links.js', 'recipe_story_links.js']) {
  const fullPath = resolve(source, 'src/js/config', cfgFile);
  if (existsSync(fullPath)) {
    vm.runInContext(await readFile(fullPath, 'utf8'), linksContext);
  }
}
await writeFile(
  resolve(target, 'assets/game-links.js'),
  `window.GAME_LINKS = ${JSON.stringify({
    partners: linksContext.window.KSool.AFFILIATE_PARTNERS || {},
    items: linksContext.window.KSool.AFFILIATE_ITEM_LINKS || {},
    stories: linksContext.window.KSool.RECIPE_STORY_LINKS || {}
  })};`,
  'utf8'
);

console.log(`Synced ${bundle.recipes.length} recipes, i18n locales, and story/affiliate links from KSool_Gemini.`);

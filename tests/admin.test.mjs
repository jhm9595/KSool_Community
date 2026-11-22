import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/sqlite.mjs';
import { handleApi, normalizeItems } from '../server/worker.mjs';

function makeEnv(db) {
  return {
    DB: db,
    GAME_ORIGINS: 'https://ksool.minibig.pw',
    ADMIN_EMAILS: 'super@example.com',
    ADMIN_VERIFY_OVERRIDE: async (token) => {
      if (token === 'super-token') return { email: 'super@example.com' };
      if (token === 'mod-token') return { email: 'mod@example.com' };
      return { email: 'user@example.com' };
    }
  };
}

const call = (env, path, options = {}) =>
  handleApi(new Request(`https://ksool.minibig.pw${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  }), env);

test('admin RBAC, prompt generator, and game-rule validation work end-to-end', async () => {
  const db = openDatabase(':memory:');
  try {
    const env = makeEnv(db);
    // 1. Non-admin check (no hardcoded email fallback)
    const noAuth = await call(env, '/api/admin/me');
    assert.equal((await noAuth.json()).isAdmin, false);

    const userForbidden = await call(env, '/api/admin/overview', {
      headers: { Authorization: 'Bearer user-token' }
    });
    assert.equal(userForbidden.status, 403);

    // 2. Super admin check & delegate partial permission ('posts' only) to mod@example.com
    const superMe = await (await call(env, '/api/admin/me', {
      headers: { Authorization: 'Bearer super-token' }
    })).json();
    assert.equal(superMe.isAdmin, true);
    assert.equal(superMe.isSuperAdmin, true);

    const addRoleRes = await call(env, '/api/admin/roles', {
      method: 'POST',
      headers: { Authorization: 'Bearer super-token' },
      body: JSON.stringify({ email: 'mod@example.com', permissions: ['posts'] })
    });
    assert.equal(addRoleRes.status, 200);

    const modMe = await (await call(env, '/api/admin/me', {
      headers: { Authorization: 'Bearer mod-token' }
    })).json();
    assert.equal(modMe.isAdmin, true);
    assert.equal(modMe.isSuperAdmin, false);
    assert.deepEqual(modMe.permissions, ['posts']);

    // Mod cannot create updates or manage roles
    const modUpdateFail = await call(env, '/api/admin/updates', {
      method: 'POST',
      headers: { Authorization: 'Bearer mod-token' },
      body: JSON.stringify({ version: 'v2.5', date: '2026-11-19', title: '공지', body: '내용' })
    });
    assert.equal(modUpdateFail.status, 403);

    // 3. Game-rule validation: >4 slots rejected
    assert.throws(() => normalizeItems([
      { ingredient_id: 101, ratio: 1 },
      { ingredient_id: 102, ratio: 1 },
      { ingredient_id: 103, ratio: 1 },
      { ingredient_id: 104, ratio: 1 },
      { ingredient_id: 105, ratio: 1 }
    ]));

    // 4. Prompt generator works for super admin
    const promptRes = await call(env, '/api/admin/generate-recipe-prompt', {
      method: 'POST',
      headers: { Authorization: 'Bearer super-token' },
      body: JSON.stringify({ items: [{ ingredient_id: 101, detail_id: null, ratio: 2 }, { ingredient_id: 102, detail_id: null, ratio: 1 }] })
    });
    assert.equal(promptRes.status, 200);
    const promptData = await promptRes.json();
    assert.match(promptData.prompt, /recipe_id/);

    // 5. Language storage and filtering on posts and suggestions
    const koPostRes = await call(env, '/api/posts', {
      method: 'POST',
      body: JSON.stringify({ kind: 'tip', lang: 'ko', title: '소맥 황금비율 팁', body: '맥주 먼저 따르세요', author: '주모' })
    });
    assert.equal(koPostRes.status, 201);
    assert.equal((await koPostRes.json()).post.lang, 'ko');

    const enPostRes = await call(env, '/api/posts', {
      method: 'POST',
      body: JSON.stringify({
        kind: 'experiment',
        lang: 'en',
        title: 'Melon Soda Bomb',
        body: 'Great refreshing mix',
        author: 'Bartender',
        items: [{ ingredient_id: 202, ratio: 3 }, { ingredient_id: 206, ratio: 2 }]
      })
    });
    assert.equal(enPostRes.status, 201);
    assert.equal((await enPostRes.json()).post.lang, 'en');

    const koOnlyPosts = await (await call(env, '/api/posts?lang=ko')).json();
    assert.equal(koOnlyPosts.posts.length, 1);
    assert.equal(koOnlyPosts.posts[0].lang, 'ko');

    const enOnlyPosts = await (await call(env, '/api/posts?lang=en')).json();
    assert.equal(enOnlyPosts.posts.length, 1);
    assert.equal(enOnlyPosts.posts[0].lang, 'en');

    const enOnlySugs = await (await call(env, '/api/suggestions?lang=en')).json();
    assert.equal(enOnlySugs.suggestions.length, 1);
    assert.equal(enOnlySugs.suggestions[0].lang, 'en');

    // 6. Affiliate partners declarative registry, locale filtering, and Admin ON/OFF + CRUD
    const koAff = await (await call(env, '/api/affiliates?lang=ko')).json();
    assert.deepEqual(koAff.partners.map(p => p.id), ['coupang', 'ohouse']);
    assert.equal(koAff.partners[0].url, 'https://link.coupang.com/a/iSnsj2FEfk');
    assert.equal(koAff.partners[1].url, 'https://ozip.me/u15xC78?af');
    assert.match(koAff.partners[0].disclosure.ko, /쿠팡 파트너스/);
    assert.match(koAff.partners[1].disclosure.ko, /오늘의집 큐레이터/);

    const frAff = await (await call(env, '/api/affiliates?lang=fr')).json();
    assert.ok(frAff.partners.some(p => p.id === 'amazon-fr'));
    assert.ok(!frAff.partners.some(p => p.id === 'coupang'));

    const toggleOff = await call(env, '/api/admin/affiliates/coupang', {
      method: 'PUT',
      headers: { Authorization: 'Bearer super-token' },
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(toggleOff.status, 200);
    const koAfterOff = await (await call(env, '/api/affiliates?lang=ko')).json();
    assert.deepEqual(koAfterOff.partners.map(p => p.id), ['ohouse']);

    const addCustom = await call(env, '/api/admin/affiliates', {
      method: 'POST',
      headers: { Authorization: 'Bearer super-token' },
      body: JSON.stringify({
        id: 'custom-shop',
        order: 5,
        locales: ['ko', 'en'],
        icon: '🍹',
        url: 'https://example.com/shop',
        name: { ko: '테스트샵', en: 'Test Shop' },
        disclosure: { ko: '제휴 수수료를 받을 수 있습니다.', en: 'Affiliate disclosure.' }
      })
    });
    assert.equal(addCustom.status, 201);
    const koWithCustom = await (await call(env, '/api/affiliates?lang=ko')).json();
    assert.deepEqual(koWithCustom.partners.map(p => p.id), ['custom-shop', 'ohouse']);
  } finally {
    db.close();
  }
});

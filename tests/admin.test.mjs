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
  } finally {
    db.close();
  }
});

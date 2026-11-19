import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/sqlite.mjs';
import { handleApi } from '../server/worker.mjs';

function makeEnv(db, adminEmail = 'jhm9595@gmail.com') {
  return {
    DB: db,
    GAME_ORIGINS: 'https://ksool.minibig.pw',
    ADMIN_EMAILS: 'jhm9595@gmail.com',
    ADMIN_VERIFY_OVERRIDE: async (token) => (token === 'valid-admin-token' ? { email: adminEmail } : { email: 'user@example.com' })
  };
}

const call = (env, path, options = {}) =>
  handleApi(new Request(`https://ksool.minibig.pw${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  }), env);

test('admin endpoints reject non-admin and allow admin management', async () => {
  const db = openDatabase(':memory:');
  try {
    const env = makeEnv(db);
    // 1. Non-admin check
    const noAuth = await call(env, '/api/admin/me');
    assert.equal((await noAuth.json()).isAdmin, false);

    const forbidden = await call(env, '/api/admin/overview', {
      headers: { Authorization: 'Bearer other-token' }
    });
    assert.equal(forbidden.status, 403);

    // 2. Admin check
    const isAdmin = await call(env, '/api/admin/me', {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    assert.equal((await isAdmin.json()).isAdmin, true);

    // 3. Create post & update announcement
    const postRes = await call(env, '/api/posts', {
      method: 'POST',
      body: JSON.stringify({ kind: 'tip', title: '테스트 글', body: '내용', author: '유저' })
    });
    assert.equal(postRes.status, 201);
    const { post } = await postRes.json();

    const updRes = await call(env, '/api/admin/updates', {
      method: 'POST',
      headers: { Authorization: 'Bearer valid-admin-token' },
      body: JSON.stringify({ version: 'v2.5', date: '2026-11-19', title: '공지', body: '새 소식' })
    });
    assert.equal(updRes.status, 201);

    const publicUpdates = await call(env, '/api/updates');
    assert.equal((await publicUpdates.json()).updates.length, 1);

    const overviewRes = await call(env, '/api/admin/overview', {
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    assert.equal(overviewRes.status, 200);
    const overview = await overviewRes.json();
    assert.equal(overview.posts.length, 1);
    assert.equal(overview.updates.length, 1);

    // 4. Delete post as admin
    const delRes = await call(env, `/api/admin/posts/${post.id}`, {
      method: 'DELETE',
      headers: { Authorization: 'Bearer valid-admin-token' }
    });
    assert.equal(delRes.status, 200);
  } finally {
    db.close();
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
function harness() {
  const context = vm.createContext({});
  const normalize = source.slice(source.indexOf('  const normalizeRecIds'), source.indexOf('  function decodeSyncInput'));
  const merge = source.slice(source.indexOf('  function mergeProgressRow'), source.indexOf('  let progressRequest'));
  vm.runInContext(`const byId = new Map([[1,{}],[2,{}],[3,{}]]); let syncedProgress = {mode:'quiz',quiz:[3],tycoon:[3],quizIngredients:[999],tycoonIngredients:[]}; const saveSyncedProgress=()=>{}; ${normalize} ${merge}`, context);
  return expression => JSON.parse(vm.runInContext(`JSON.stringify(${expression})`, context));
}
test('progress IDs are unique, numeric and present in the displayed catalog', () => {
  const run = harness();
  assert.deepEqual(run("normalizeRecIds(['rec:1',1,'2',999,'bad',null])"), [1,2]);
});
test('cloud snapshots replace old records and respect explicit empty progress', () => {
  const run = harness();
  run("mergeProgressRow({quiz_state:{unlockedRecipeIds:['rec:1',1],unlockedIngredientIds:[202]},quiz_unlocked:[2],tycoon_unlocked:[2]}) ?? null");
  assert.deepEqual(run('syncedProgress.quiz'), [1]);
  assert.deepEqual(run('syncedProgress.tycoon'), [2]);
  assert.deepEqual(run('syncedProgress.quizIngredients'), [202]);
  run("mergeProgressRow({quiz_state:{unlockedRecipeIds:[]},tycoon_unlocked:[]}) ?? null");
  assert.deepEqual(run('syncedProgress.quiz'), []);
  assert.equal(run('syncedProgress.mode'), 'quiz');
});

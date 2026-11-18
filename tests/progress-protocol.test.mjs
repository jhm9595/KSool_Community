import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../progress-protocol.js', import.meta.url), 'utf8'), context);
const state = () => ({unlockedRecipeIds:[1],unlockedIngredientIds:[202],purchasedIngredientIds:[]});
const message = () => ({type:'KSOOL_PROGRESS',version:1,requestId:'request-a',sequence:1,mode:'quiz',quiz:state(),tycoon:state()});
test('receiver rejects invalid snapshots without consuming their sequence', () => {
  const receiver = context.KSoolProgressProtocol.createReceiver('request-a');
  for (const patch of [{version:2},{requestId:'old-request'},{mode:'unknown'},{quiz:null},{quiz:{unlockedRecipeIds:[]}}, {sequence:NaN}]) {
    assert.equal(receiver.accept({...message(),...patch}),false);
  }
  assert.equal(receiver.accept(message()),true);
  assert.equal(receiver.accept(message()),false);
  assert.equal(receiver.accept({...message(),sequence:0}),false);
  assert.equal(receiver.accept({...message(),sequence:2,quiz:{...state(),unlockedRecipeIds:[]}}),true);
});
test('reference sender and receiver complete handshake, heartbeat, change and reset', () => {
  const sent=[], handlers={}; let heartbeat;
  const parent={postMessage:(value,origin)=>sent.push({value,origin})};
  const game=vm.createContext({window:{parent,addEventListener:(type,cb)=>handlers[type]=cb},setInterval:cb=>heartbeat=cb});
  vm.runInContext(readFileSync(new URL('../integration/game-progress-bridge.js',import.meta.url),'utf8'),game);
  game.window.KSoolCommunityBridge.publish({mode:'quiz',quiz:state(),tycoon:state()});
  assert.equal(sent.length,0);
  handlers.message({origin:'https://wrong.example',source:parent,data:{type:'KSOOL_PROGRESS_REQUEST',version:1,requestId:'request-a'}});
  assert.equal(sent.length,0);
  handlers.message({origin:'https://ksool.minibig.pw',source:parent,data:{type:'KSOOL_PROGRESS_REQUEST',version:1,requestId:'request-a'}});
  const receiver=context.KSoolProgressProtocol.createReceiver('request-a');
  assert.equal(receiver.accept(sent.at(-1).value),true);
  assert.equal(sent.at(-1).origin,'https://ksool.minibig.pw');
  heartbeat(); assert.equal(receiver.accept(sent.at(-1).value),true);
  game.window.KSoolCommunityBridge.publish({mode:'tycoon',quiz:{...state(),unlockedRecipeIds:[]},tycoon:state()});
  assert.equal(receiver.accept(sent.at(-1).value),true);
  assert.equal(sent.at(-1).value.mode,'tycoon');
  assert.equal(sent.at(-1).value.quiz.unlockedRecipeIds.length,0);
});

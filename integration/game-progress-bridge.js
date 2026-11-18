/** GAME-SIDE REFERENCE ONLY. Copy into the real game project; not loaded by community. */
(() => {
  'use strict';
  const parentOrigin = 'https://ksool.minibig.pw';
  let requestId = null, sequence = 0, snapshot = null;
  function send() {
    if (!requestId || !snapshot || window.parent === window) return;
    window.parent.postMessage({type:'KSOOL_PROGRESS', version:1, requestId,
      sequence:++sequence, ...snapshot}, parentOrigin);
  }
  window.addEventListener('message', event => {
    if (event.origin !== parentOrigin || event.source !== window.parent) return;
    const msg = event.data;
    if (msg?.type !== 'KSOOL_PROGRESS_REQUEST' || msg.version !== 1 ||
        typeof msg.requestId !== 'string' || msg.requestId.length > 100) return;
    if (requestId !== msg.requestId) { requestId = msg.requestId; sequence = 0; }
    send();
  });
  window.KSoolCommunityBridge = {
    // Call only after BOTH modes are initialized, and after each state change.
    // Missing state is NOT an empty state: wait for initialization instead.
    publish(value) {
      if (!['quiz','tycoon'].includes(value?.mode)) throw new Error('Invalid mode');
      const copyMode = mode => {
        if (!mode) throw new Error('Both modes must be initialized');
        return Object.fromEntries(['unlockedRecipeIds','unlockedIngredientIds','purchasedIngredientIds'].map(key => {
          if (!Array.isArray(mode[key]) || !mode[key].every(id => Number.isSafeInteger(id) && id > 0)) throw new Error('Invalid IDs: '+key);
          return [key, [...new Set(mode[key])]];
        }));
      };
      snapshot = {mode:value.mode, quiz:copyMode(value.quiz), tycoon:copyMode(value.tycoon)};
      send();
    }
  };
  // Full snapshot heartbeat keeps the game authoritative while idle.
  setInterval(send, 5000);
})();

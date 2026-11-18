/* Community-side progress protocol. No game storage or authentication access. */
(() => {
  'use strict';
  function createReceiver(requestId) {
    let lastSequence = -1;
    const isIds = value => Array.isArray(value) && value.length <= 10000 &&
      value.every(id => Number.isSafeInteger(id) && id > 0);
    const isMode = value => value && ['unlockedRecipeIds', 'unlockedIngredientIds', 'purchasedIngredientIds'].every(key => isIds(value[key]));
    return {
      accept(message) {
        if (!message || message.type !== 'KSOOL_PROGRESS' || message.version !== 1 ||
          message.requestId !== requestId || !Number.isSafeInteger(message.sequence) ||
          message.sequence <= lastSequence || !['quiz', 'tycoon'].includes(message.mode) ||
          !isMode(message.quiz) || !isMode(message.tycoon)) return false;
        lastSequence = message.sequence;
        return true;
      }
    };
  }
  globalThis.KSoolProgressProtocol = { createReceiver };
})();

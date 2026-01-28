// src/shared/rawStateStore.js
// Stores latest values by key. Emits change notifications.

export function createRawStateStore() {
  const map = new Map();
  const listeners = new Set();

  function set(key, value) {
    const prev = map.get(key);
    // For objects, this will always treat new references as changes (fine here).
    if (Object.is(prev, value)) return;
    map.set(key, value);
    for (const fn of listeners) fn({ key, value, prev });
  }

  function get(key) {
    return map.get(key);
  }

  function subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function snapshot() {
    return Object.fromEntries(map.entries());
  }

  return { set, get, subscribe, snapshot };
}


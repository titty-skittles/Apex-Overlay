// src/shared/rawStateStore.js
// Stores latest values by key. Emits change notifications.

export function createRawStateStore() {
  const map = new Map();
  const listeners = new Set();

  function emit(change) {
    for (const fn of listeners) fn(change);
  }

  function set(key, value) {
    const prev = map.get(key);
    if (Object.is(prev, value)) return;
    map.set(key, value);
    emit({ key, value, prev });
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

  // NEW: store an element object and also flatten its fields into leaf keys.
  // Emits exactly ONE notification (type: "bulk") per call.
  function setDeep(key, value, { maxDepth = 2 } = {}) {
    const changes = [];

    function write(k, v) {
      const prev = map.get(k);
      if (Object.is(prev, v)) return;
      map.set(k, v);
      changes.push({ key: k, value: v, prev });
    }

    function flatten(baseKey, obj, depth) {
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return;
      if (depth >= maxDepth) return;

      for (const [field, v] of Object.entries(obj)) {
        const childKey = `${baseKey}.${field}`;
        write(childKey, v);
        flatten(childKey, v, depth + 1);
      }
    }

    // always store the root element
    write(key, value);

    // and flatten if it’s an object
    flatten(key, value, 0);

    // notify once
    if (changes.length) {
      emit({ type: "bulk", rootKey: key, changes });
    }
  }

  return { set, setDeep, get, subscribe, snapshot };
}

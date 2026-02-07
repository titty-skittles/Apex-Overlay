// src/shared/sseClient.js

/**
 * Create a small SSE client wrapper.
 *
 * Usage:
 *   const sse = createSseClient("/sse");
 *   sse.onJson("overlay", (data) => { ... });
 *   sse.on("error", () => { ... });
 *   sse.connect();
 *
 *   // later:
 *   sse.close();
 */
export function createSseClient(url = "/sse") {
  let es = null;

  const handlers = new Map();      // eventName -> Set(fn)
  const statusHandlers = new Set(); // fn(status)

  function emit(eventName, payload) {
    const set = handlers.get(eventName);
    if (!set) return;
    for (const fn of set) {
      try { fn(payload); } catch (e) { console.error(e); }
    }
  }

  function emitStatus(status) {
    for (const fn of statusHandlers) {
      try { fn(status); } catch (e) { console.error(e); }
    }
  }

  function on(eventName, fn) {
    if (!handlers.has(eventName)) handlers.set(eventName, new Set());
    handlers.get(eventName).add(fn);
    return () => handlers.get(eventName)?.delete(fn);
  }

  function onJson(eventName, fn) {
    return on(eventName, (ev) => {
      // When wired through addEventListener, we’ll pass the raw MessageEvent.
      // If someone calls emit manually, allow plain objects too.
      const raw = ev?.data ?? ev;
      try {
        const data = typeof raw === "string" ? JSON.parse(raw) : raw;
        fn(data);
      } catch (e) {
        console.warn(`SSE ${eventName}: bad JSON`, raw);
      }
    });
  }

  function onStatus(fn) {
    statusHandlers.add(fn);
    return () => statusHandlers.delete(fn);
  }

  function connect() {
    if (es) return; // already connected
    es = new EventSource(url);

    emitStatus({ connected: false, state: "connecting" });

    // Default "message" event if server uses unnamed events
    es.onmessage = (ev) => emit("message", ev);

    es.onopen = () => emitStatus({ connected: true, state: "open" });

    // EventSource fires "error" on disconnects; it also auto-reconnects.
    es.onerror = () => emitStatus({ connected: false, state: "error" });

    // Wire all named handlers (except built-ins) to EventSource listeners
    for (const [eventName] of handlers) {
      if (eventName === "message") continue;
      es.addEventListener(eventName, (ev) => emit(eventName, ev));
    }

    return es;
  }

  function close() {
    if (!es) return;
    es.close();
    es = null;
    emitStatus({ connected: false, state: "closed" });
  }

  return { on, onJson, onStatus, connect, close };
}

export function createSseClient(url) {
  let es = null;

  const jsonHandlers = new Map();
  const statusHandlers = new Set();
  const registeredEvents = new Set(); // ✅

  function emitStatus(partial) {
    for (const fn of statusHandlers) {
      try { fn(partial); } catch {}
    }
  }

  function onStatus(fn) {
    statusHandlers.add(fn);
    return () => statusHandlers.delete(fn);
  }


  function ensureListener(eventName) {
    if (!es) return;
    if (registeredEvents.has(eventName)) return;
    registeredEvents.add(eventName);

    es.addEventListener(eventName, (ev) => {
      const raw = ev.data;
      let obj;
      try { obj = JSON.parse(String(raw).trim()); }
      catch { console.error(`SSE ${eventName}: bad JSON`, raw); return; }

      const hs = jsonHandlers.get(eventName);
      if (!hs) return;
      for (const f of hs) {
        try { f(obj); } catch (err) { console.error(`SSE ${eventName}: handler error`, err); }
      }
    });
  }

  function onJson(eventName, fn) {
    if (!jsonHandlers.has(eventName)) jsonHandlers.set(eventName, new Set());
    jsonHandlers.get(eventName).add(fn);
    ensureListener(eventName); // ✅ works both pre/post connect
    return () => jsonHandlers.get(eventName)?.delete(fn);
  }

  function connect() {
    if (es) return;

    emitStatus({ phase: "connecting", url });
    es = new EventSource(url);

    es.onopen = () => emitStatus({ phase: "open", url });
    es.onerror = () => emitStatus({ phase: "error", url });

    ensureListener("ping");
    for (const name of jsonHandlers.keys()) ensureListener(name);
  }

  function close() {
    try { es?.close(); } catch {}
    es = null;
    registeredEvents.clear(); // ✅ reset
    emitStatus({ phase: "closed", url });
  }

  return {
    connect,
    close,
    onStatus,
    onJson,
  };
}

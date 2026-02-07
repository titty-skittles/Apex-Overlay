// src/control/connectionProbe.js

export function initConnectionProbe({
  wsInput,
  testConnBtn,
  connPill,
  connDot,
  connText,
  connMeta,
  saveWsUrl,
  setStatus, // (msg, good?) => void
}) {
  if (!wsInput || !testConnBtn || !connPill || !connDot || !connText || !connMeta) {
    console.error("[probe] missing required DOM nodes", {
      wsInput, testConnBtn, connPill, connDot, connText, connMeta,
    });
    return;
  }
  if (typeof saveWsUrl !== "function") {
    console.error("[probe] saveWsUrl must be provided");
    return;
  }

  let probe = {
    ws: null,
    url: "",
    lastOpenAt: 0,
    lastMsgAt: 0,
    tickTimer: null,
    reconnectTimer: null,
    staleAfterMs: 8000,   // no messages for 8s => stale
    reconnectMs: 1500,
  };

  function setConnUI(state, meta = "") {
    const map = {
      idle:       { dot: "#999",    text: "Not connected",          border: "#ddd" },
      connecting: { dot: "#f59e0b", text: "Connecting…",            border: "#f3c77a" },
      open:       { dot: "#0ea5e9", text: "Connected (no data yet)", border: "#86d4f5" },
      receiving:  { dot: "#16a34a", text: "Connected + receiving",  border: "#86efac" },
      stale:      { dot: "#f97316", text: "Stale (no recent data)", border: "#fdba74" },
      error:      { dot: "#b42318", text: "Error",                  border: "#f2b8b5" },
      closed:     { dot: "#999",    text: "Disconnected",           border: "#ddd" },
    };

    const s = map[state] || map.idle;
    connDot.style.background = s.dot;
    connPill.style.borderColor = s.border;
    connText.textContent = s.text;
    connMeta.textContent = meta;
  }

  function clearProbeTimers() {
    if (probe.tickTimer) clearInterval(probe.tickTimer);
    if (probe.reconnectTimer) clearTimeout(probe.reconnectTimer);
    probe.tickTimer = null;
    probe.reconnectTimer = null;
  }

  function stopProbe() {
    clearProbeTimers();
    if (probe.ws) {
      try { probe.ws.close(); } catch {}
    }
    probe.ws = null;
    probe.url = "";
    probe.lastOpenAt = 0;
    probe.lastMsgAt = 0;
    setConnUI("idle", "");
  }

  function startProbe(url) {
    // reset existing connection
    clearProbeTimers();
    if (probe.ws) {
      try { probe.ws.close(); } catch {}
    }

    probe.url = url;
    probe.lastOpenAt = 0;
    probe.lastMsgAt = 0;

    setConnUI("connecting", url);

    let ws;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setConnUI("error", String(e));
      return;
    }
    probe.ws = ws;

    ws.addEventListener("open", () => {
      probe.lastOpenAt = Date.now();
      setConnUI("open", `Open • ${url}`);

      probe.tickTimer = setInterval(() => {
        const now = Date.now();

        // never received a message yet
        if (!probe.lastMsgAt) {
          const secs = Math.floor((now - probe.lastOpenAt) / 1000);
          if (now - probe.lastOpenAt > probe.staleAfterMs) {
            setConnUI("stale", `Open, no messages for ${secs}s • ${url}`);
          } else {
            setConnUI("open", `Open, waiting for data (${secs}s) • ${url}`);
          }
          return;
        }

        // received messages; check freshness
        const ageMs = now - probe.lastMsgAt;
        const ageS = Math.floor(ageMs / 1000);
        if (ageMs > probe.staleAfterMs) {
          setConnUI("stale", `Last message ${ageS}s ago • ${url}`);
        } else {
          setConnUI("receiving", `Last message ${ageS}s ago • ${url}`);
        }
      }, 500);
    });

    ws.addEventListener("message", () => {
      probe.lastMsgAt = Date.now();
      setConnUI("receiving", `Receiving • ${url}`);
    });

    ws.addEventListener("error", () => {
      setConnUI("error", `WebSocket error • ${url}`);
    });

    ws.addEventListener("close", (ev) => {
      clearProbeTimers();
      probe.ws = null;

      const reason = (ev.reason || "").trim();
      const meta = `Closed (${ev.code})${reason ? ` • ${reason}` : ""} • ${url}`;
      setConnUI("closed", meta);

      // auto-reconnect (only if the input still matches)
      probe.reconnectTimer = setTimeout(() => {
        if (wsInput.value.trim() === url) startProbe(url);
      }, probe.reconnectMs);
    });
  }

  // click: test connection
  testConnBtn.addEventListener("click", () => {
    try {
      const saved = saveWsUrl(wsInput.value);
      startProbe(saved);
      setStatus?.("Testing connection…");
    } catch (e) {
      setStatus?.(e.message || String(e), false);
    }
  });

  // debounced: probe while typing (optional but handy)
  let urlDebounce = null;
  wsInput.addEventListener("input", () => {
    if (urlDebounce) clearTimeout(urlDebounce);
    urlDebounce = setTimeout(() => {
      const raw = wsInput.value.trim();
      if (!raw) { stopProbe(); return; }

      try {
        const saved = saveWsUrl(raw);
        startProbe(saved);
      } catch {
        stopProbe();
        setConnUI("idle", "Enter a valid ws:// URL to test");
      }
    }, 400);
  });

  // initial auto-probe on load
  try {
    const saved = saveWsUrl(wsInput.value);
    startProbe(saved);
  } catch {
    setConnUI("idle", "Enter a valid ws:// URL to test");
  }

  // allow caller to stop it if needed
  return { startProbe, stopProbe };
}

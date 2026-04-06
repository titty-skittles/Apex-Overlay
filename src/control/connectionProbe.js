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

  let pollTimer = null;
  let testRun = 0;

  function setConnUI(state, meta = "") {
    const map = {
      idle:       { dot: "#999",    text: "Not connected",           border: "#ddd" },
      connecting: { dot: "#f59e0b", text: "Testing…",                border: "#f3c77a" },
      open:       { dot: "#0ea5e9", text: "Connected (no data yet)", border: "#86d4f5" },
      receiving:  { dot: "#16a34a", text: "Connected + receiving",   border: "#86efac" },
      stale:      { dot: "#f97316", text: "Stale (no recent data)",  border: "#fdba74" },
      error:      { dot: "#b42318", text: "Error",                   border: "#f2b8b5" },
      closed:     { dot: "#999",    text: "Disconnected",            border: "#ddd" },
    };

    const s = map[state] || map.idle;
    connDot.style.background = s.dot;
    connPill.style.borderColor = s.border;
    connText.textContent = s.text;
    connMeta.textContent = meta;
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function saveServerWsUrl(wsUrl) {
    const r = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scoreboardWs: wsUrl }),
    });
    if (!r.ok) throw new Error("Failed to configure server WS");
    return r.json();
  }

  async function fetchHealth() {
    const r = await fetch("/health");
    if (!r.ok) throw new Error("Health check failed");
    return r.json();
  }

  function paintFromHealth(health, url) {
    const sb = health?.scoreboard;

    if (!sb?.configured) {
      setConnUI("idle", "Server not configured");
      return;
    }

    if (!sb.connected) {
      setConnUI("closed", `Disconnected • ${url}`);
      return;
    }

    if (sb.stale) {
      const age = sb.lastMessageMsAgo != null
        ? `Last test message ${Math.floor(sb.lastMessageMsAgo / 1000)}s ago • ${url}`
        : url;
      setConnUI("stale", age);
      return;
    }

    if (sb.lastMessageMsAgo == null) {
      setConnUI("open", `Open • ${url}`);
      return;
    }

    const ageS = Math.floor(sb.lastMessageMsAgo / 1000);
    setConnUI("receiving", `Last test message ${ageS}s ago • ${url}`);
  }

  async function runServerProbe(url) {
    const runId = ++testRun;

    stopPolling();
    setConnUI("connecting", url);

    await saveServerWsUrl(url);

    let health = null;
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 700));
      health = await fetchHealth();
      if (runId !== testRun) return;

      paintFromHealth(health, url);

      if (health?.scoreboard?.connected && !health?.scoreboard?.stale) {
        break;
      }
    }

    pollTimer = setInterval(async () => {
      try {
        const h = await fetchHealth();
        if (runId !== testRun) return;
        paintFromHealth(h, url);
      } catch (e) {
        if (runId !== testRun) return;
        setConnUI("error", e.message || String(e));
      }
    }, 2000);

    return health;
  }

  testConnBtn.addEventListener("click", async () => {
    try {
      const saved = saveWsUrl(wsInput.value);
      testConnBtn.disabled = true;
      await runServerProbe(saved);
      setStatus?.("Testing server connection…");
    } catch (e) {
      setConnUI("error", e.message || String(e));
      setStatus?.(e.message || String(e), false);
    } finally {
      testConnBtn.disabled = false;
    }
  });

  // Initial passive status load only
  (async () => {
    try {
      const health = await fetchHealth();
      paintFromHealth(health, wsInput.value.trim());
    } catch {
      setConnUI("idle", "Press Test connection");
    }
  })();

  return {
    refresh: async () => {
      const health = await fetchHealth();
      paintFromHealth(health, wsInput.value.trim());
    },
    stopProbe: stopPolling,
  };
}
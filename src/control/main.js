import { getSavedWsUrl, saveWsUrl } from "../shared/config.js";

const wsInput = document.getElementById("wsUrl");
const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const openProgramBtn = document.getElementById("openProgramBtn");
const copyProgramBtn = document.getElementById("copyProgramBtn");

function setStatus(msg, good = true) {
  statusEl.textContent = msg;
  statusEl.style.color = good ? "#1a7f37" : "#b42318";
}

function getProgramUrl(wsUrl) {
  const u = new URL(window.location.href);
  // Always point to program.html on the same dev server / host
  u.pathname = u.pathname.replace(/\/[^/]*$/, "/program.html");
  u.searchParams.set("ws", wsUrl);
  return u.toString();
}

// init input from saved value if present
wsInput.value = getSavedWsUrl() || "ws://127.0.0.1:8000/WS/";

saveBtn.addEventListener("click", () => {
  try {
    const saved = saveWsUrl(wsInput.value);
    setStatus(`Saved WS URL: ${saved}`);
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

openProgramBtn.addEventListener("click", () => {
  try {
    const saved = saveWsUrl(wsInput.value); // ensure it’s valid + saved
    window.open(getProgramUrl(saved), "_blank", "noopener,noreferrer");
    setStatus("Opened Program page in a new tab.");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

copyProgramBtn.addEventListener("click", async () => {
  try {
    const saved = saveWsUrl(wsInput.value);
    const url = getProgramUrl(saved);
    await navigator.clipboard.writeText(url);
    setStatus("Copied Program URL to clipboard.");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

// --- Connection health probe (control page) ---
const connPill = document.getElementById("connPill");
const connDot = document.getElementById("connDot");
const connText = document.getElementById("connText");
const connMeta = document.getElementById("connMeta");
const testConnBtn = document.getElementById("testConnBtn");

let probe = {
  ws: null,
  url: "",
  lastOpenAt: 0,
  lastMsgAt: 0,
  lastErr: "",
  tickTimer: null,
  staleAfterMs: 8000,   // no messages for 8s => stale
  reconnectMs: 1500,
  reconnectTimer: null,
};

function setConnUI(state, meta = "") {
  // state: "idle" | "connecting" | "open" | "receiving" | "stale" | "error" | "closed"
  const map = {
    idle:       { dot: "#999",  text: "Not connected", border: "#ddd" },
    connecting: { dot: "#f59e0b", text: "Connecting…",  border: "#f3c77a" },
    open:       { dot: "#0ea5e9", text: "Connected (no data yet)", border: "#86d4f5" },
    receiving:  { dot: "#16a34a", text: "Connected + receiving", border: "#86efac" },
    stale:      { dot: "#f97316", text: "Stale (no recent data)", border: "#fdba74" },
    error:      { dot: "#b42318", text: "Error", border: "#f2b8b5" },
    closed:     { dot: "#999",  text: "Disconnected", border: "#ddd" },
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
  probe.lastOpenAt = 0;
  probe.lastMsgAt = 0;
  probe.lastErr = "";
  setConnUI("idle", "");
}

function startProbe(url) {
  // Reset existing
  stopProbe();
  probe.url = url;

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
    probe.lastMsgAt = 0;
    setConnUI("open", `Open • ${url}`);

    // Optional: If your server supports it, send a ping
    // ws.send(JSON.stringify({ type: "ping", t: Date.now() }));

    probe.tickTimer = setInterval(() => {
      const now = Date.now();

      // If we've never received a message, show how long since open
      if (!probe.lastMsgAt) {
        const secs = Math.floor((now - probe.lastOpenAt) / 1000);
        // after a while with no messages, call it stale
        if (now - probe.lastOpenAt > probe.staleAfterMs) {
          setConnUI("stale", `Open, no messages for ${secs}s • ${url}`);
        } else {
          setConnUI("open", `Open, waiting for data (${secs}s) • ${url}`);
        }
        return;
      }

      // We have received messages; check freshness
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
    // UI will flip to receiving on next tick, but do it immediately too
    setConnUI("receiving", `Receiving • ${url}`);
  });

  ws.addEventListener("error", () => {
    probe.lastErr = "WebSocket error";
    setConnUI("error", `${probe.lastErr} • ${url}`);
  });

  ws.addEventListener("close", (ev) => {
    clearProbeTimers();
    probe.ws = null;
    const reason = (ev.reason || "").trim();
    const meta = `Closed (${ev.code})${reason ? ` • ${reason}` : ""} • ${url}`;
    setConnUI("closed", meta);

    // auto-reconnect (handy while you’re typing URLs / restarting server)
    probe.reconnectTimer = setTimeout(() => {
      // only reconnect if the input still matches what we were probing
      if (wsInput.value.trim() === url) startProbe(url);
    }, probe.reconnectMs);
  });
}

// Run probe when user clicks "Test connection"
testConnBtn.addEventListener("click", () => {
  try {
    const saved = saveWsUrl(wsInput.value); // validates + normalises if you do that
    startProbe(saved);
    setStatus("Testing connection…");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

// Bonus: restart probe when the WS URL changes (debounced)
let urlDebounce = null;
wsInput.addEventListener("input", () => {
  if (urlDebounce) clearTimeout(urlDebounce);
  urlDebounce = setTimeout(() => {
    const raw = wsInput.value.trim();
    if (!raw) { stopProbe(); return; }
    // Don't validate on every keystroke if you don't want—this tries anyway
    try {
      const saved = saveWsUrl(raw);
      startProbe(saved);
    } catch {
      // show idle while URL is invalid mid-typing
      stopProbe();
      setConnUI("idle", "Enter a valid ws:// URL to test");
    }
  }, 400);
});

// Start probing the initial saved URL on load
try {
  startProbe(saveWsUrl(wsInput.value));
} catch {
  setConnUI("idle", "Enter a valid ws:// URL to test");
}

function normalizeToWsUrl(input, wsPath = "/WS/") {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("WebSocket URL cannot be empty.");

  // If it already looks like ws(s)://, keep it but normalise path if missing
  if (/^wss?:\/\//i.test(raw)) {
    const u = new URL(raw);
    if (!u.pathname || u.pathname === "/") u.pathname = wsPath;
    return u.toString();
  }

  // If it's http(s)://, convert scheme to ws(s):// and force wsPath
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    u.protocol = (u.protocol === "https:") ? "wss:" : "ws:";
    u.pathname = wsPath;
    u.search = ""; // usually you don't want query params for the socket endpoint
    u.hash = "";
    return u.toString();
  }

  // If user pasted something like "localhost:8000" (no scheme)
  // Treat it as http:// and then convert.
  const withScheme = "http://" + raw.replace(/^\/+/, "");
  const u = new URL(withScheme);
  u.protocol = "ws:";
  u.pathname = wsPath;
  u.search = "";
  u.hash = "";
  return u.toString();
}

// src/shared/scoreboardClient.js
// Robust WS client for scoreboard ingest: reconnect, register paths, emit updates.

import { chooseWsUrl } from "./config.js";

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function createScoreboardClient({
  wsUrl,
  paths = [],
  onUpdate = () => {},
  onStatus = () => {},
  staleMs = 5000,
} = {}) {
  const url = wsUrl || chooseWsUrl({ fallback: import.meta.env.VITE_SCOREBOARD_WS });

  let ws = null;
  let stopped = false;

  let connected = false;
  let attempt = 0;

  let lastMessageAt = 0;
  let staleTimer = null;
  let stale = true;

  function setStatus(partial) {
    onStatus({
      url,
      connected,
      attempt,
      lastMessageAt,
      stale,
      ...partial,
    });
  }

  function markMessage() {
    lastMessageAt = Date.now();
    if (stale) {
      stale = false;
      setStatus({ stale });
    }
    if (staleTimer) clearTimeout(staleTimer);
    staleTimer = setTimeout(() => {
      stale = true;
      setStatus({ stale });
    }, staleMs);
  }

  function sendRegister() {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    if (!paths || paths.length === 0) return;
    ws.send(JSON.stringify({ action: "Register", paths }));
  }

  async function connectLoop() {
    while (!stopped) {
      try {
        setStatus({ phase: "connecting" });
        ws = new WebSocket(url);

        ws.addEventListener("open", () => {
          connected = true;
          attempt = 0;
          setStatus({ connected, phase: "open" });
          sendRegister();
        });

        ws.addEventListener("message", (event) => {
          markMessage();

          let obj;
          try {
            obj = JSON.parse(event.data);
          } catch (e) {
            setStatus({ phase: "bad_json", error: String(e) });
            return;
          }

          const state = obj?.state;
          if (!state || typeof state !== "object") return;

          for (const [key, value] of Object.entries(state)) {
            onUpdate({ key, value, raw: obj });
          }
        });

        ws.addEventListener("error", () => {
          setStatus({ phase: "error" });
        });

        await new Promise((resolve) => {
          ws.addEventListener("close", () => resolve(), { once: true });
        });

        connected = false;
        setStatus({ connected, phase: "closed" });
      } catch (e) {
        connected = false;
        setStatus({ connected, phase: "exception", error: String(e) });
      }

      if (stopped) break;

      attempt += 1;
      const base = clamp(250 * Math.pow(2, attempt), 250, 8000);
      const jitter = Math.floor(Math.random() * 250);
      const waitMs = base + jitter;

      setStatus({ phase: "reconnecting", waitMs });
      await sleep(waitMs);
    }
  }

  return {
    url,
    start() {
      stopped = false;
      stale = true;
      setStatus({ phase: "starting" });
      connectLoop(); // intentionally not awaited
    },
    stop() {
      stopped = true;
      if (staleTimer) clearTimeout(staleTimer);
      staleTimer = null;

      try {
        ws?.close();
      } catch {
        // ignore
      }

      ws = null;
      connected = false;
      setStatus({ connected, phase: "stopped" });
    },
  };
}
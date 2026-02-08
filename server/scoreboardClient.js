// server/scoreboardClient.js
// Server-side scoreboard WS client with runtime-configurable URL

import WebSocket from "ws";
import { createRawStateStore } from "../src/shared/rawStateStore.js";


function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

export function startScoreboardClient({
  paths = [],
  staleMs = 5000,
  onStatus = () => {},
  onUpdate = () => {},
} = {}) {
  const store = createRawStateStore();

  let wsUrl = "";
  let ws = null;
  let stopped = true;

  let connected = false;
  let attempt = 0;

  let lastMessageAt = 0;
  let staleTimer = null;
  let stale = true;
	let msgCount = 0;
	let lastCloseAt = 0;
	let lastErrorAt = 0;
	let lastError = "";




  function setStatus(partial = {}) {
    onStatus({
      wsUrl,
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

    const payload = { action: "Register", paths };
    //console.log("[scoreboard] ->", JSON.stringify(payload));
    ws.send(JSON.stringify(payload));
  }

  async function connectLoop() {
    while (!stopped && wsUrl) {
      try {
        connected = false;
        setStatus({ connected, phase: "connecting" });

        ws = new WebSocket(wsUrl);

        // Wait for close with code/reason logging (single source of truth)
        const closePromise = new Promise((resolve) => {
          ws.once("close", (code, reason) => {
            lastCloseAt = Date.now();
            connected = false;

            const closeReason = String(reason || "");
            console.warn("[scoreboard] ws closed", code, closeReason);

            setStatus({
              connected,
              phase: "closed",
              closeCode: code,
              closeReason,
            });

            resolve();
          });
        });

        ws.on("open", () => {
          //console.log("[scoreboard] open -> subscribing", paths);
          //console.log("[scoreboard] open", wsUrl);

          connected = true;
          attempt = 0;
          setStatus({ connected, phase: "open" });
          sendRegister();
        });

        ws.on("message", (data) => {
          let msg;
          try {
            msg = JSON.parse(String(data));
          } catch (e) {
            console.warn("[scoreboard] bad JSON", e);
            return;
          }

          const state = msg?.state ?? msg;
          if (!state || typeof state !== "object") return;

          for (const [key, value] of Object.entries(state)) {
            store.set(key, value);
          }

          markMessage();
          onUpdate();
        });

        ws.on("error", (e) => {
          lastErrorAt = Date.now();
          lastError = String(e?.message || e);
          console.warn("[scoreboard] ws error", e);
          setStatus({ phase: "error", error: String(e?.message || e) });
        });

        // Block until this socket closes
        await closePromise;
      } catch (e) {
        connected = false;
        setStatus({ connected, phase: "exception", error: String(e) });
      }

      if (stopped || !wsUrl) break;

      attempt += 1;
      const base = clamp(250 * Math.pow(2, attempt), 250, 8000);
      const jitter = Math.floor(Math.random() * 250);
      const waitMs = base + jitter;

      setStatus({ phase: "reconnecting", waitMs });
      await sleep(waitMs);
    }
  }

  function start() {
    if (!wsUrl) return;
    stopped = false;
    stale = true;
    setStatus({ phase: "starting" });
    connectLoop(); // fire-and-forget
  }

  function stop() {
    stopped = true;
    if (staleTimer) clearTimeout(staleTimer);
    staleTimer = null;
    try { ws?.close(); } catch {}
    ws = null;
    connected = false;
    setStatus({ connected, phase: "stopped" });
  }

  function setWsUrl(nextUrl) {
    const url = String(nextUrl || "").trim();
    if (!url) {
      stop();
      wsUrl = "";
      return;
    }

    wsUrl = url;
    stop();
    start();
  }

  function getStatus() {
    return { wsUrl, connected, lastMessageAt, stale, msgCount, lastCloseAt, lastErrorAt, lastError };
  }

  return {
    store,
    setWsUrl,
    getStatus,
  };
}


import { getSavedWsUrl, saveWsUrl } from "../shared/config.js";
import { initOverlayControls } from "./overlayControls.js";
import { initConnectionProbe } from "./connectionProbe.js";
import { createSseClient } from "../shared/sseClient.js";

// --- DOM ---
const wsInput = document.getElementById("wsUrl");
const testConnBtn = document.getElementById("testConnBtn");

const statusEl = document.getElementById("status");
const saveBtn = document.getElementById("saveBtn");
const openProgramBtn = document.getElementById("openProgramBtn");
const copyProgramBtn = document.getElementById("copyProgramBtn");

// --- helpers ---
function setStatus(msg, good = true) {
  if (!statusEl) return;
  statusEl.textContent = msg || "";
  statusEl.style.color = good ? "#1a7f37" : "#b42318";
}

function getProgramUrl(wsUrl) {
  const u = new URL(window.location.href);
  u.pathname = u.pathname.replace(/\/[^/]*$/, "/program.html");
  u.searchParams.set("ws", wsUrl);
  return u.toString();
}

// --- init WS URL field ---
wsInput.value = getSavedWsUrl() || "ws://127.0.0.1:8000/WS/";

// --- buttons ---
saveBtn.addEventListener("click", async () => {
  try {
    const saved = saveWsUrl(wsInput.value); // your local storage
    await saveServerWsUrl(saved);           // server config
    setStatus(`Saved WS URL: ${saved}`);
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

(async () => {
  try {
    const r = await fetch("/api/config");
    if (!r.ok) return;
    const j = await r.json();
    if (j.scoreboardWs) wsInput.value = j.scoreboardWs;
  } catch {}
})();


openProgramBtn.addEventListener("click", () => {
  try {
    const saved = saveWsUrl(wsInput.value);
    window.open(getProgramUrl(saved), "_blank", "noopener,noreferrer");
    setStatus("Opened Program page in a new tab.");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

window.addEventListener("DOMContentLoaded", () => {
  const sse = createSseClient("/sse");

  sse.onJson("model", (m) => {
    const el = document.getElementById("t1-name-long");
    if (!el) return;

    el.textContent = m?.teams?.[0]?.name ?? "";
  });


  /* sse.onJson("model", (m) => {
    const t1El = document.getElementById("t1-ws-name");
    const t2El = document.getElementById("t2-ws-name");
    if (!t1El || !t2El) return;

    t1El.textContent = m?.teams?.[0]?.name
      ? `WS: ${m.teams[0].name}`
      : "";

    t2El.textContent = m?.teams?.[1]?.name
      ? `WS: ${m.teams[1].name}`
      : "";
  });
 */
  sse.connect();
});


async function saveServerWsUrl(wsUrl) {
  const r = await fetch("/api/config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scoreboardWs: wsUrl }),
  });
  if (!r.ok) throw new Error("Failed to configure server WS");
}



copyProgramBtn.addEventListener("click", async () => {
  try {
    const saved = saveWsUrl(wsInput.value);
    await saveServerWsUrl(saved);
    await navigator.clipboard.writeText(getProgramUrl(saved));
    setStatus("Copied Program URL to clipboard.");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

// overlay controls (names / colours / apply / reset)
initOverlayControls();

// --- connection probe ---
initConnectionProbe({
  wsInput,
  testConnBtn,
  connPill: document.getElementById("connPill"),
  connDot: document.getElementById("connDot"),
  connText: document.getElementById("connText"),
  connMeta: document.getElementById("connMeta"),
  saveWsUrl,
  setStatus,
});
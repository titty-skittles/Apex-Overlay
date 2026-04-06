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
    const t1LongCrg = document.getElementById("t1-name-long-crg");
    const t2LongCrg = document.getElementById("t2-name-long-crg");
    const t1ShortCrg = document.getElementById("t1-name-short-crg");
    const t2ShortCrg = document.getElementById("t2-name-short-crg");

    console.log("[control crg]", {
      el: t1LongCrg,
      value: m?.teams?.[0]?.crgNameLong,
    });

    if (t1LongCrg) t1LongCrg.textContent = m?.teams?.[0]?.crgNameLong ?? "";
    if (t2LongCrg) t2LongCrg.textContent = m?.teams?.[1]?.crgNameLong ?? "";
    if (t1ShortCrg) t1ShortCrg.textContent = m?.teams?.[0]?.crgNameShort ?? "";
    if (t2ShortCrg) t2ShortCrg.textContent = m?.teams?.[1]?.crgNameShort ?? "";

  });

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
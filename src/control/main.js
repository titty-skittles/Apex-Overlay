import { getSavedWsUrl, saveWsUrl } from "../shared/config.js";
import { initOverlayControls } from "./overlayControls.js";
import { initConnectionProbe } from "./connectionProbe.js";
import { loadOverlaySettings } from "../shared/overlaySettings.js";

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
    const saved = saveWsUrl(wsInput.value);
    window.open(getProgramUrl(saved), "_blank", "noopener,noreferrer");
    setStatus("Opened Program page in a new tab.");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

copyProgramBtn.addEventListener("click", async () => {
  try {
    const saved = saveWsUrl(wsInput.value);
    await navigator.clipboard.writeText(getProgramUrl(saved));
    setStatus("Copied Program URL to clipboard.");
  } catch (e) {
    setStatus(e.message || String(e), false);
  }
});

// --- overlay settings ---
let overlaySettings = loadOverlaySettings();
const settingsBus = createOverlaySettingsBus();

// overlay controls (names / colours / apply / reset)
// IMPORTANT: initOverlayControls returns a small API we can call to refresh the form.
const overlayUi = initOverlayControls({
  settingsBus,
  getSettings: () => overlaySettings,
  setSettings: (next) => { overlaySettings = next || {}; },
});

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

// Keep the control UI in sync when settings change elsewhere (program tab / other control tab)
settingsBus.subscribe((next) => {
  overlaySettings = next || {};
  overlayUi?.setForm?.(overlaySettings);
});

// Fallback: localStorage event (some browsers / contexts)
window.addEventListener("storage", (e) => {
  if (e.key === "apexOverlay.overlaySettings") {
    overlaySettings = loadOverlaySettings();
    overlayUi?.setForm?.(overlaySettings);
  }
});

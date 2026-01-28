import { getSavedWsUrl, saveWsUrl } from "../shared/config.js";

const app = document.getElementById("app");

app.innerHTML = `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; padding: 20px; max-width: 900px;">
<h1 style="margin: 0 0 12px;">Apex Overlay — Control</h1>

<section style="border: 1px solid #ddd; border-radius: 12px; padding: 16px; margin-bottom: 16px;">
<h2 style="margin: 0 0 10px; font-size: 18px;">Connection Settings</h2>

<label style="display:block; font-size: 14px; margin-bottom: 6px;">
Scoreboard WebSocket URL
</label>

<div style="display:flex; gap: 8px; align-items: center; flex-wrap: wrap;">
<input id="wsUrl" type="text" placeholder="ws://127.0.0.1:8000/WS/"
style="flex: 1; min-width: 320px; padding: 10px 12px; border: 1px solid #ccc; border-radius: 10px; font-size: 14px;" />

<button id="saveBtn"
style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; background: #f6f6f6; cursor: pointer;">
Save
</button>

<button id="openProgramBtn"
style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; background: #f6f6f6; cursor: pointer;">
Open Program
</button>

<button id="copyProgramBtn"
style="padding: 10px 12px; border-radius: 10px; border: 1px solid #ccc; background: #f6f6f6; cursor: pointer;">
Copy Program URL
</button>
</div>

<p id="status" style="margin: 10px 0 0; font-size: 13px;"></p>
</section>

<section style="border: 1px solid #eee; border-radius: 12px; padding: 16px;">
<h2 style="margin: 0 0 10px; font-size: 18px;">Next</h2>
<div style="color:#444; font-size:14px;">
We’ll add buttons here to Take/Clear lower thirds, stat overlays, etc.
</div>
</section>
</div>
`;

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

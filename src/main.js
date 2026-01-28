import { createScoreboardClient } from "../shared/scoreboardClient.js";

const app = document.getElementById("app");

// Simple on-screen debug (we'll replace later with real UI)
const pre = document.createElement("pre");
pre.style.margin = "0";
pre.style.padding = "16px";
pre.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";
pre.style.fontSize = "14px";
pre.style.color = "white";
pre.style.whiteSpace = "pre-wrap";
app.appendChild(pre);

let lastUpdate = null;
let status = null;

function render() {
  const lines = [];
  lines.push("Apex Overlay — PROGRAM");
  lines.push("");
  lines.push(`WS: ${status?.url ?? "(unknown)"}`);
  lines.push(`Connected: ${status?.connected ? "yes" : "no"}`);
  lines.push(`Phase: ${status?.phase ?? "-"}`);
  lines.push(`Stale: ${status?.stale ? "yes" : "no"}`);
  if (status?.waitMs) lines.push(`Reconnect in: ${status.waitMs}ms`);
  if (status?.error) lines.push(`Error: ${status.error}`);
  lines.push("");
  lines.push("Last update:");
  lines.push(lastUpdate ? JSON.stringify(lastUpdate, null, 2) : "(none yet)");

  pre.textContent = lines.join("\n");
}

const client = createScoreboardClient({
  // If you don't pass wsUrl, it will read ?ws=... or fall back to localhost.
  paths: ["ScoreBoard.CurrentGame"],
  staleMs: 5000,
  onStatus: (s) => {
    status = s;
    render();
  },
  onUpdate: (u) => {
    lastUpdate = u; // { key, value, raw }
    render();
  },
});

client.start();
render();


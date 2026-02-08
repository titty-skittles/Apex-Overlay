// server/sseServer.js
import express from "express";
import { buildOverlayModel } from "../src/shared/overlayModel.js";
import { mergeOverlaySettings, DEFAULT_OVERLAY_SETTINGS } from "../src/shared/overlaySettings.js";
import { startScoreboardClient } from "./scoreboardClient.js";

const scoreboard = startScoreboardClient({
  paths: ["ScoreBoard.CurrentGame"],
  onStatus: (st) => {
/*     console.log(
      "[scoreboard]",
      st.phase ?? "(status)",
      st.connected ? "connected" : "disconnected",
      st.closeCode ? `code=${st.closeCode}` : "",
      st.closeReason ? `reason=${st.closeReason}` : ""
    ); */
  },
  onUpdate: broadcastModel,
});
scoreboard.setWsUrl("ws://localhost:8000/WS/"); // TEMP: known working endpoint

const store = scoreboard.store;

/** connected SSE clients */
const clients = new Set();

// ---- health stats ----
const serverStartedAt = Date.now();
let lastSseClientAt = 0;

let lastOverlayUpdateAt = 0;

let lastModelBroadcastAt = 0;
let lastModelSizeBytes = 0;

// ---- overlay settings + scoreboard ingest ----
let overlaySettings = structuredClone(DEFAULT_OVERLAY_SETTINGS);

// ---- model broadcast ----
let lastModelJson = ""; // store the JSON string so we can send to late joiners

let lastModel = null;

const sticky = {
  t1: { jammer: { name: "", number: "" }, status: "" },
  t2: { jammer: { name: "", number: "" }, status: "" },
};

function broadcastModel() {
  const model = buildOverlayModel(store.get, overlaySettings);

  // if (!model.ui) {
  //   console.log("[broadcastModel] ui missing", {
  //     statusLabel: model.statusLabel,
  //     keys: Object.keys(model),
  //   });
  // } else {
  //   console.log("[broadcastModel] ui OK", model.statusLabel, model.ui);
  // }

  const json = JSON.stringify(model);

  //console.log("[broadcastModel] called");
  if (json === lastModelJson) return;

  lastModelJson = json;
  lastModelSizeBytes = Buffer.byteLength(json, "utf8");
  lastModelBroadcastAt = Date.now();

  const msg = `event: model\ndata: ${json}\n\n`;
  for (const c of clients) c.res.write(msg);

}

// ---- express ----
const app = express();
app.use(express.json());

let currentWsUrl = ""; // optionally persist later

app.get("/api/config", (req, res) => {
  res.json({ scoreboardWs: currentWsUrl });
});

app.post("/api/config", (req, res) => {
  const url = String(req.body?.scoreboardWs || "").trim();
  currentWsUrl = url;
  scoreboard.setWsUrl(url);
  res.json({ ok: true, scoreboardWs: currentWsUrl });
});


// Health endpoint
app.get("/health", (req, res) => {
  const now = Date.now();
  const msAgo = (t) => (t ? Math.max(0, now - t) : null);

  const sb = scoreboard.getStatus();

  res.json({
    ok: true,
    uptimeMs: now - serverStartedAt,

    clients: {
      sse: clients.size,
    },

    scoreboard: {
      configured: !!sb.wsUrl,
      wsUrl: sb.wsUrl || "",
      connected: sb.connected,           // ← THIS is the real value
      stale: sb.stale,
      lastMessageMsAgo: msAgo(sb.lastMessageAt),
    },

    model: {
      lastBroadcastMsAgo: msAgo(lastModelBroadcastAt),
      lastPayloadBytes: lastModelSizeBytes,
      lastOverlayUpdateMsAgo: msAgo(lastOverlayUpdateAt),
    },


  });
});


// Control publishes overlay overrides here
app.post("/api/overlay", (req, res) => {
  lastOverlayUpdateAt = Date.now();
  overlaySettings = mergeOverlaySettings(overlaySettings, req.body || {});
  broadcastModel();
  res.json({ ok: true, clients: clients.size });
});

// SSE endpoint
app.get("/sse", (req, res) => {
  lastSseClientAt = Date.now();

  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const client = { res };
  clients.add(client);

  // Send initial snapshot immediately (model is what clients render)
  if (lastModelJson) {
    res.write(`event: model\ndata: ${lastModelJson}\n\n`);
  } else {
    // If we haven't broadcast yet, do an initial compute
    broadcastModel();
    if (lastModelJson) res.write(`event: model\ndata: ${lastModelJson}\n\n`);
  }

  // Keepalive ping to prevent idle timeouts
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(ping);
    clients.delete(client);
  });
});


const port = process.env.PORT || 5174;

setInterval(() => {
  const sb = scoreboard.getStatus();
/*   console.log("[healthcheck]", {
    connected: sb.connected,
    stale: sb.stale,
    lastMsgAgoMs: sb.lastMessageAt ? (Date.now() - sb.lastMessageAt) : null,
  }); */
}, 2000);

app.listen(port, () => console.log(`SSE server on :${port}`));

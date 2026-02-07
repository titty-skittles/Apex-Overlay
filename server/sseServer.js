// server/sseServer.js
import express from "express";

const app = express();
app.use(express.json());

/** connected SSE clients */
const clients = new Set();

/** last known overlay settings so late-joiners get state */
let lastOverlay = {};



/** SSE endpoint */
app.get("/sse", (req, res) => {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");

  // Helpful if you're behind some proxies (Nginx, etc.)
  res.flushHeaders?.();

  const client = { res };
  clients.add(client);

  // Send initial state immediately
  res.write(`event: overlay\n`);
  res.write(`data: ${JSON.stringify(lastOverlay)}\n\n`);

  // Keepalive ping to prevent idle timeouts
  const ping = setInterval(() => {
    res.write(`event: ping\ndata: {}\n\n`);
  }, 15000);

  req.on("close", () => {
    clearInterval(ping);
    clients.delete(client);
  });
});

/** control publishes overlay overrides here */
app.post("/api/overlay", (req, res) => {
  const patch = req.body ?? {};
  lastOverlay = patch; // or merge if you prefer server-side merge

  const msg = `event: overlay\ndata: ${JSON.stringify(patch)}\n\n`;
  for (const c of clients) c.res.write(msg);

  res.json({ ok: true, clients: clients.size });
});

const port = process.env.PORT || 5174;
app.listen(port, () => console.log(`SSE server on :${port}`));

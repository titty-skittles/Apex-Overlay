// src/shared/overlayPublisher.js

/**
 * Send a full settings snapshot or a patch to the SSE server.
 * Server broadcasts it to program via SSE.
 */
export async function publishOverlaySettings(patchOrFull) {
  const r = await fetch("/api/overlay", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patchOrFull ?? {}),
  });

  if (!r.ok) {
    const text = await r.text().catch(() => "");
    throw new Error(`Publish failed: ${r.status} ${text}`.trim());
  }

  return r.json().catch(() => ({}));
}

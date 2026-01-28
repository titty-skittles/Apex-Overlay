// src/shared/config.js

export function chooseWsUrl({ fallback } = {}) {
  // Allow overriding by query string: ?ws=ws://...
  const u = new URL(window.location.href);
  const q = u.searchParams.get("ws");
  if (q && q.trim()) return q.trim();

  // Then env var (Vite)
  if (fallback && String(fallback).trim()) return String(fallback).trim();

  // Finally default
  return "ws://localhost:8000/WS/";
}


const KEY = "apexOverlay.scoreboardWs";

export function getWsUrlFromQuery() {
  const url = new URL(window.location.href);
  const v = url.searchParams.get("ws");
  return v && v.trim() ? v.trim() : null;
}

export function getSavedWsUrl() {
  try {
    const v = localStorage.getItem(KEY);
    return v && v.trim() ? v.trim() : null;
  } catch {
    return null;
  }
}

export function saveWsUrl(wsUrl) {
  const v = (wsUrl || "").trim();
  if (!v) throw new Error("WS URL cannot be empty.");
  // super light validation (enough to avoid obvious mistakes)
  if (!/^wss?:\/\/.+/i.test(v)) throw new Error("WS URL must start with ws:// or wss://");
    localStorage.setItem(KEY, v);
  return v;
}

/*export function chooseWsUrl({ fallback } = {}) {
  return (
    getWsUrlFromQuery() ||
    getSavedWsUrl() ||
    (fallback || null) ||
    "ws://127.0.0.1:8000/WS/"
  );
}*/

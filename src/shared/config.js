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
const DEFAULT_WS_PATH = "/WS/"

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

export function normalizeWsUrl(input, wsPath = DEFAULT_WS_PATH) {
  const raw = String(input || "").trim();
  if (!raw) throw new Error("WS URL cannot be empty.");

  // ws:// or wss:// already
  if (/^wss?:\/\//i.test(raw)) {
    const u = new URL(raw);
    // If user gave only host/port, enforce path
    if (!u.pathname || u.pathname === "/") u.pathname = wsPath;
    return u.toString();
  }

  // http:// or https:// -> ws:// or wss://
  if (/^https?:\/\//i.test(raw)) {
    const u = new URL(raw);
    u.protocol = (u.protocol === "https:") ? "wss:" : "ws:";
    u.pathname = wsPath;
    u.search = "";
    u.hash = "";
    return u.toString();
  }

  // No scheme, e.g. "localhost:8000" or "127.0.0.1:8000"
  const withScheme = "http://" + raw.replace(/^\/+/, "");
  const u = new URL(withScheme);
  u.protocol = "ws:";
  u.pathname = wsPath;
  u.search = "";
  u.hash = "";
  return u.toString();
}

export function saveWsUrl(wsUrl) {
  const v = normalizeWsUrl(wsUrl);

  // Extra sanity: ensure ws/wss
  const u = new URL(v);
  if (!/^wss?:$/.test(u.protocol)) {
    throw new Error("WS URL must start with ws:// or wss://");
  }

  localStorage.setItem(KEY, v);
  return v;
}

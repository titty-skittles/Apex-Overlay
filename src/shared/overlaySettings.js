// src/shared/overlaySettings.js
export const DEFAULT_OVERLAY_SETTINGS = {
  teams: {
    1: {
      nameLong: "",
      nameShort: "",
      colors: {
        primaryBg: "",
        primaryText: "",
        secondaryBg: "",
        secondaryText: "",
      },
    },
    2: {
      nameLong: "",
      nameShort: "",
      colors: {
        primaryBg: "",
        primaryText: "",
        secondaryBg: "",
        secondaryText: "",
      },
    },
  },
  background: { mode: "green", color: "#00ff00" },
};


// ---- merge ----
// shallow-ish deep merge tailored for this shape
export function mergeOverlaySettings(base, patch) {
  const out = structuredClone(base || {});
  const p = patch || {};

  out.teams ??= {};

  out.background = {
    ...(out.background || {}),
    ...(p.background || {}),
  };

  out.teams[1] = {
    ...(out.teams[1] || {}),
    ...(p.teams?.[1] || {}),
    colors: { ...(out.teams[1]?.colors || {}), ...(p.teams?.[1]?.colors || {}) },
  };

  out.teams[2] = {
    ...(out.teams[2] || {}),
    ...(p.teams?.[2] || {}),
    colors: { ...(out.teams[2]?.colors || {}), ...(p.teams?.[2]?.colors || {}) },
  };

  return out;
}

// ---- persistence (optional but useful) ----
export function loadOverlaySettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULT_OVERLAY_SETTINGS);
    const parsed = JSON.parse(raw);
    return mergeOverlaySettings(DEFAULT_OVERLAY_SETTINGS, parsed);
  } catch {
    return structuredClone(DEFAULT_OVERLAY_SETTINGS);
  }
}

export function saveOverlaySettings(next) {
  const merged = mergeOverlaySettings(DEFAULT_OVERLAY_SETTINGS, next || {});
  try {
    localStorage.setItem(KEY, JSON.stringify(merged));
  } catch {
    // ignore quota / private mode issues
  }
  return merged;
}

// src/control/overlayControls.js
import {
  loadOverlaySettings,
  saveOverlaySettings,
  mergeOverlaySettings,
  DEFAULT_OVERLAY_SETTINGS,
} from "../shared/overlaySettings.js";

import { publishOverlaySettings } from "../shared/overlayPublisher.js";

function $(id) { return document.getElementById(id); }

export function initOverlayControls() {
  let settings = loadOverlaySettings();

  function readForm() {
    return {
      teams: {
        1: {
          nameLong: $("t1-name-long")?.value?.trim() || "",
          nameShort: $("t1-name-short")?.value?.trim() || "",
          colors: {
            primary: $("t1-color-primary")?.value || "",
            secondary: $("t1-color-secondary")?.value || "",
            text: $("t1-color-text")?.value || "",
          },
        },
        2: {
          nameLong: $("t2-name-long")?.value?.trim() || "",
          nameShort: $("t2-name-short")?.value?.trim() || "",
          colors: {
            primary: $("t2-color-primary")?.value || "",
            secondary: $("t2-color-secondary")?.value || "",
            text: $("t2-color-text")?.value || "",
          },
        },
      },
    };
  }

  function fillForm(s) {
    const t1 = s?.teams?.[1] || DEFAULT_OVERLAY_SETTINGS.teams[1];
    const t2 = s?.teams?.[2] || DEFAULT_OVERLAY_SETTINGS.teams[2];

    if ($("t1-name-long")) $("t1-name-long").value = t1.nameLong || "";
    if ($("t1-name-short")) $("t1-name-short").value = t1.nameShort || "";
    if ($("t1-color-primary")) $("t1-color-primary").value = t1.colors?.primary || "#000000";
    if ($("t1-color-secondary")) $("t1-color-secondary").value = t1.colors?.secondary || "#ffffff";
    if ($("t1-color-text")) $("t1-color-text").value = t1.colors?.text || "#ffffff";

    if ($("t2-name-long")) $("t2-name-long").value = t2.nameLong || "";
    if ($("t2-name-short")) $("t2-name-short").value = t2.nameShort || "";
    if ($("t2-color-primary")) $("t2-color-primary").value = t2.colors?.primary || "#000000";
    if ($("t2-color-secondary")) $("t2-color-secondary").value = t2.colors?.secondary || "#ffffff";
    if ($("t2-color-text")) $("t2-color-text").value = t2.colors?.text || "#ffffff";
  }

  let statusTimer = null;
  function setStatus(msg, kind = "info") {
    const el = $("overlayStatus");
    if (!el) return;

    el.textContent = msg || "";
    el.dataset.kind = kind; // optional for CSS: [data-kind="error"] etc.

    if (statusTimer) clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      el.textContent = "";
      el.dataset.kind = "";
    }, 1600);
  }

  function setBusy(isBusy) {
    const btn = $("overlayApplyBtn");
    if (btn) btn.disabled = !!isBusy;
  }

  // initial paint
  fillForm(settings);

  $("overlayApplyBtn")?.addEventListener("click", async () => {
    const patch = readForm();
    settings = mergeOverlaySettings(settings, patch);

    // Persist locally (control page convenience)
    settings = saveOverlaySettings(settings);

    setBusy(true);
    try {
      // Push to server -> program receives via SSE
      await publishOverlaySettings(settings);
      setStatus("Applied ✔", "ok");
    } catch (e) {
      console.error("[control] publish failed", e);
      setStatus("Publish failed ✖", "error");
      // Up to you: keep local saved state even if publish fails (currently yes)
    } finally {
      setBusy(false);
    }
  });

  // "Reload saved" behavior (current)
  $("overlayResetBtn")?.addEventListener("click", () => {
    const saved = loadOverlaySettings();
    settings = saved;
    fillForm(saved);
    setStatus("Reloaded saved", "info");
  });

  // Optional: if you add a "Defaults" button
  $("overlayDefaultsBtn")?.addEventListener("click", () => {
    settings = structuredClone(DEFAULT_OVERLAY_SETTINGS);
    fillForm(settings);
    saveOverlaySettings(settings);
    setStatus("Defaults loaded", "info");
  });

  return {
    getSettings: () => settings,
    setForm(next) {
      settings = next || {};
      fillForm(settings);
    },
  };
}

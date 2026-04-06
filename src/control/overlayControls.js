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
            primaryBg: $("t1-color-primary-bg")?.value || "",
            secondaryBg: $("t1-color-secondary-bg")?.value || "",
            primaryText: $("t1-color-primary-text")?.value || "",
            secondaryText: $("t1-color-secondary-text")?.value || "",
          },
        },
        2: {
          nameLong: $("t2-name-long")?.value?.trim() || "",
          nameShort: $("t2-name-short")?.value?.trim() || "",
          colors: {
            primaryBg: $("t2-color-primary-bg")?.value || "",
            secondaryBg: $("t2-color-secondary-bg")?.value || "",
            primaryText: $("t2-color-primary-text")?.value || "",
            secondaryText: $("t2-color-secondary-text")?.value || "",
          },
        },
      },
      background: {
        mode: $("background-mode")?.value || "green",
        color: $("background-color")?.value || "#00ff00",
      }
    };
  }

  function fillForm(s) {
    const t1 = s?.teams?.[1] || DEFAULT_OVERLAY_SETTINGS.teams[1];
    const t2 = s?.teams?.[2] || DEFAULT_OVERLAY_SETTINGS.teams[2];
    const bg = s?.background || DEFAULT_OVERLAY_SETTINGS.background;

    if ($("t1-name-long")) $("t1-name-long").value = t1.nameLong || "";
    if ($("t1-name-short")) $("t1-name-short").value = t1.nameShort || "";
    if ($("t1-color-primary-bg")) $("t1-color-primary-bg").value = t1.colors?.primaryBg || "#000000";
    if ($("t1-color-primary-text")) $("t1-color-primary-text").value = t1.colors?.primaryText || "#ffffff";
    if ($("t1-color-secondary-bg")) $("t1-color-secondary-bg").value = t1.colors?.secondaryBg || "#000000";
    if ($("t1-color-secondary-text")) $("t1-color-secondary-text").value = t1.colors?.secondaryText || "#ffffff";

    if ($("t2-name-long")) $("t2-name-long").value = t2.nameLong || "";
    if ($("t2-name-short")) $("t2-name-short").value = t2.nameShort || "";
    if ($("t2-color-primary-bg")) $("t2-color-primary-bg").value = t2.colors?.primaryBg || "#000000";
    if ($("t2-color-primary-text")) $("t2-color-primary-text").value = t2.colors?.primaryText || "#ffffff";
    if ($("t2-color-secondary-bg")) $("t2-color-secondary-bg").value = t2.colors?.secondaryBg || "#000000";
    if ($("t2-color-secondary-text")) $("t2-color-secondary-text").value = t2.colors?.secondaryText || "#ffffff";

    if ($("background-mode")) $("background-mode").value = bg.mode || "green";
    if ($("background-color")) $("background-color").value = bg.color || "#00ff00";
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
    console.log("[control patch]", patch);
    settings = mergeOverlaySettings(settings, patch);
    console.log("[control merged settings", settings);

    // Persist locally (control page convenience)
    settings = saveOverlaySettings(settings);
    console.log("[control saved settings]", settings);

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

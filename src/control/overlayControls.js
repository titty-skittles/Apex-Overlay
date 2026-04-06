// src/control/overlayControls.js
import {
  loadOverlaySettings,
  saveOverlaySettings,
  mergeOverlaySettings,
  DEFAULT_OVERLAY_SETTINGS,
} from "../shared/overlaySettings.js";

import { publishOverlaySettings } from "../shared/overlayPublisher.js";

function $(id) { return document.getElementById(id); }

function normalizeHex(value) {
  const v = String(value || "").trim();
  if (!v) return "";

  const withHash = v.startsWith("#") ? v : `#${v}`;
  return /^#[0-9a-fA-F]{6}$/.test(withHash) ? withHash.toUpperCase() : "";
}

function setColorPair(colorId, hexId, value, fallback) {
  const colorEl = $(colorId);
  const hexEl = $(hexId);
  const next = normalizeHex(value) || fallback;

  if (colorEl) colorEl.value = next;
  if (hexEl) hexEl.value = next;
}

function wireColorPair(colorId, hexId) {
  const colorEl = $(colorId);
  const hexEl = $(hexId);
  if (!colorEl || !hexEl) return;

  colorEl.addEventListener("input", () => {
    hexEl.value = colorEl.value.toUpperCase();
  });

  hexEl.addEventListener("input", () => {
    const norm = normalizeHex(hexEl.value);
    if (norm) colorEl.value = norm;
  });

  hexEl.addEventListener("blur", () => {
    const norm = normalizeHex(hexEl.value);
    hexEl.value = norm || colorEl.value.toUpperCase() || "";
  });
}

export function initOverlayControls() {
  let settings = loadOverlaySettings();
  let liveModel = null;

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
    console.log("[fillForm input]", s);

    const t1 = s?.teams?.[1] || DEFAULT_OVERLAY_SETTINGS.teams[1];
    const t2 = s?.teams?.[2] || DEFAULT_OVERLAY_SETTINGS.teams[2];
    const bg = s?.background || DEFAULT_OVERLAY_SETTINGS.background;

    if ($("t1-name-long")) $("t1-name-long").value = t1.nameLong || "";
    if ($("t1-name-short")) $("t1-name-short").value = t1.nameShort || "";
    setColorPair("t1-color-primary-bg", "t1-color-primary-bg-hex", t1.colors?.primaryBg, "#000000");
    setColorPair("t1-color-primary-text", "t1-color-primary-text-hex", t1.colors?.primaryText, "#FFFFFF");
    setColorPair("t1-color-secondary-bg", "t1-color-secondary-bg-hex", t1.colors?.secondaryBg, "#000000");
    setColorPair("t1-color-secondary-text", "t1-color-secondary-text-hex", t1.colors?.secondaryText, "#FFFFFF");

    if ($("t2-name-long")) $("t2-name-long").value = t2.nameLong || "";
    if ($("t2-name-short")) $("t2-name-short").value = t2.nameShort || "";
    setColorPair("t2-color-primary-bg", "t2-color-primary-bg-hex", t2.colors?.primaryBg, "#000000");
    setColorPair("t2-color-primary-text", "t2-color-primary-text-hex", t2.colors?.primaryText, "#FFFFFF");
    setColorPair("t2-color-secondary-bg", "t2-color-secondary-bg-hex", t2.colors?.secondaryBg, "#000000");
    setColorPair("t2-color-secondary-text", "t2-color-secondary-text-hex", t2.colors?.secondaryText, "#FFFFFF");

    if ($("background-mode")) $("background-mode").value = bg.mode || "green";
    setColorPair("background-color", "background-color-hex", bg.color, "#00FF00");
  }

  let statusTimer = null;
  function setStatus(msg, kind = "info") {
    const el = $("overlayStatus");
    if (!el) return;

    el.textContent = msg || "";
    el.dataset.kind = kind;

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

  fillForm(settings);

  wireColorPair("t1-color-primary-bg", "t1-color-primary-bg-hex");
  wireColorPair("t1-color-primary-text", "t1-color-primary-text-hex");
  wireColorPair("t1-color-secondary-bg", "t1-color-secondary-bg-hex");
  wireColorPair("t1-color-secondary-text", "t1-color-secondary-text-hex");

  wireColorPair("t2-color-primary-bg", "t2-color-primary-bg-hex");
  wireColorPair("t2-color-primary-text", "t2-color-primary-text-hex");
  wireColorPair("t2-color-secondary-bg", "t2-color-secondary-bg-hex");
  wireColorPair("t2-color-secondary-text", "t2-color-secondary-text-hex");

  wireColorPair("background-color", "background-color-hex");

  $("overlayApplyBtn")?.addEventListener("click", async () => {
    try {
      const patch = readForm();
      console.log("[control patch]", patch);

      settings = mergeOverlaySettings(settings, patch);
      console.log("[control merged settings]", settings);

      settings = saveOverlaySettings(settings);
      console.log("[control saved settings]", settings);
      console.log("[control raw localStorage]", localStorage.getItem("apexOverlay.overlaySettings"));

      setBusy(true);
      await publishOverlaySettings(settings);
      setStatus("Applied ✔", "ok");
    } catch (e) {
      console.error("[control apply failed]", e);
      setStatus("Publish failed ✖", "error");
    } finally {
      setBusy(false);
    }
  });

  $("overlayResetBtn")?.addEventListener("click", () => {
    const saved = loadOverlaySettings();
    settings = saved;
    fillForm(saved);
    setStatus("Reloaded saved", "info");
  });

  $("overlayDefaultsBtn")?.addEventListener("click", () => {
    if (!liveModel) {
      setStatus("No live CRG data available", "error");
      return;
    }

    const t1 = liveModel.teams?.[0] || {};
    const t2 = liveModel.teams?.[1] || {};

    fillForm({
      teams: {
        1: {
          nameLong: t1.crgNameLong || "",
          nameShort: t1.crgNameShort || "",
          colors: {
            primaryBg: t1.crgColors?.primaryBg || "",
            primaryText: t1.crgColors?.primaryText || "",
            secondaryBg: t1.crgColors?.secondaryBg || "",
            secondaryText: t1.crgColors?.secondaryText || "",
          },
        },
        2: {
          nameLong: t2.crgNameLong || "",
          nameShort: t2.crgNameShort || "",
          colors: {
            primaryBg: t2.crgColors?.primaryBg || "",
            primaryText: t2.crgColors?.primaryText || "",
            secondaryBg: t2.crgColors?.secondaryBg || "",
            secondaryText: t2.crgColors?.secondaryText || "",
          },
        },
      },
      background: settings?.background || DEFAULT_OVERLAY_SETTINGS.background,
    });

    setStatus("Loaded current CRG values into form", "info");
  });

  return {
    getSettings: () => settings,
    setForm(next) {
      settings = next || {};
      fillForm(settings);
    },
    setLiveModel(nextModel) {
      liveModel = nextModel || null;
    },
  };
}
// src/program/domBinds.js

// Cache last values so we don't spam DOM writes
const lastText = new Map();
const lastClass = new Map();

/**
 * Set text for all nodes matching data-bind="key", and also a legacy element id=key.
 */
export function setText(bindKey, value) {
  const next = String(value ?? "");

  if (lastText.get(bindKey) === next) return;
  lastText.set(bindKey, next);

  const nodes = document.querySelectorAll(`[data-bind="${bindKey}"]`);
  for (const el of nodes) el.textContent = next;

  const legacy = document.getElementById(bindKey);
  if (legacy) legacy.textContent = next;
}

export function applyTextBinds(binds) {
  for (const [key, value] of Object.entries(binds)) {
    setText(key, value ?? "");
  }
}

/**
 * Set className for all nodes matching data-bind="key", and also a legacy element id=key.
 */
export function setClass(bindKey, className) {
  const next = String(className ?? "");

  if (lastClass.get(bindKey) === next) return;
  lastClass.set(bindKey, next);

  const nodes = document.querySelectorAll(`[data-bind="${bindKey}"]`);
  for (const el of nodes) el.className = next;

  const legacy = document.getElementById(bindKey);
  if (legacy) legacy.className = next;
}

export function applyClassBinds(binds) {
  for (const [key, value] of Object.entries(binds)) {
    setClass(key, value ?? "");
  }
}

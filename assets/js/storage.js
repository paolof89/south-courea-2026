// Corea 2026 — local persistence helpers (localStorage only, no network, no PII).
// Keys follow SPEC.md section 12.

'use strict';

const SCHEMA_VERSION = 1;

const KEYS = {
  completed: 'korea2026.completedItems',
  theme: 'korea2026.theme',
  schemaVersion: 'korea2026.schemaVersion',
};

function readJSON(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    if (parsed == null || typeof parsed !== 'object') return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: silently ignore, app remains usable.
  }
}

function ensureSchemaVersion() {
  try {
    window.localStorage.setItem(KEYS.schemaVersion, String(SCHEMA_VERSION));
  } catch {
    // ignore
  }
}

/** Returns a map of itemId -> true for completed items. */
export function getCompletedMap() {
  return readJSON(KEYS.completed, {});
}

/** Marks a single item as completed/not completed and persists it. */
export function setItemCompleted(itemId, done) {
  const map = getCompletedMap();
  if (done) {
    map[itemId] = true;
  } else {
    delete map[itemId];
  }
  writeJSON(KEYS.completed, map);
  ensureSchemaVersion();
  return map;
}

/** Clears all completed-item state. */
export function resetCompleted() {
  writeJSON(KEYS.completed, {});
  ensureSchemaVersion();
}

/** Returns 'light' | 'dark' | null (null = no explicit preference stored). */
export function getTheme() {
  try {
    const value = window.localStorage.getItem(KEYS.theme);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

/** Persists the explicit theme choice ('light' | 'dark'). */
export function setTheme(theme) {
  try {
    window.localStorage.setItem(KEYS.theme, theme);
  } catch {
    // ignore
  }
  ensureSchemaVersion();
}

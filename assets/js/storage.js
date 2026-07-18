// My Trips — local persistence helpers (localStorage only, no network, no PII).
// Keys follow SPEC.md section 12. Completed-item state is namespaced per trip
// so progress on one trip never overlaps with another.

'use strict';

const SCHEMA_VERSION = 2;

const LEGACY_COMPLETED_KEY = 'korea2026.completedItems';
const LEGACY_TRIP_ID = 'korea-2026';

const KEYS = {
  theme: 'korea2026.theme',
  schemaVersion: 'korea2026.schemaVersion',
};

function completedKey(tripId) {
  return `trip.${tripId}.completedItems`;
}

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

/**
 * One-time migration: earlier single-trip versions of this app stored
 * completed items under a flat, non-namespaced key. If that legacy key still
 * exists and the Korea 2026 trip hasn't been migrated yet, move its data
 * into the namespaced key and remove the legacy one.
 */
function migrateLegacyCompletedItems() {
  try {
    const legacyRaw = window.localStorage.getItem(LEGACY_COMPLETED_KEY);
    if (legacyRaw == null) return;
    const namespacedKey = completedKey(LEGACY_TRIP_ID);
    if (window.localStorage.getItem(namespacedKey) == null) {
      window.localStorage.setItem(namespacedKey, legacyRaw);
    }
    window.localStorage.removeItem(LEGACY_COMPLETED_KEY);
  } catch {
    // ignore: storage unavailable, nothing to migrate
  }
}

/** Returns a map of itemId -> true for completed items of a given trip. */
export function getCompletedMap(tripId) {
  if (tripId === LEGACY_TRIP_ID) migrateLegacyCompletedItems();
  return readJSON(completedKey(tripId), {});
}

/** Marks a single item as completed/not completed and persists it for a given trip. */
export function setItemCompleted(tripId, itemId, done) {
  const map = getCompletedMap(tripId);
  if (done) {
    map[itemId] = true;
  } else {
    delete map[itemId];
  }
  writeJSON(completedKey(tripId), map);
  ensureSchemaVersion();
  return map;
}

/** Clears all completed-item state for a given trip. */
export function resetCompleted(tripId) {
  writeJSON(completedKey(tripId), {});
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

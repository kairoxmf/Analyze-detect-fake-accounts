const KEY = "sentinel_analysis_history";
const MAX = 20;

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function save(items) {
  try {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, MAX)));
  } catch {}
}

/**
 * Add an upload entry (file name + timestamp).
 */
export function pushUpload(fileName, meta = {}) {
  const items = load();
  items.unshift({
    type: "upload",
    name: fileName,
    at: new Date().toISOString(),
    ...meta,
  });
  save(items);
  return items;
}

/**
 * Add a lookup entry (username + optional result summary).
 */
export function pushLookup(username, meta = {}) {
  const items = load();
  items.unshift({
    type: "lookup",
    name: username,
    at: new Date().toISOString(),
    ...meta,
  });
  save(items);
  return items;
}

/**
 * Get recent history (uploads + lookups).
 */
export function getHistory() {
  return load();
}

/**
 * Clear history.
 */
export function clearHistory() {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}

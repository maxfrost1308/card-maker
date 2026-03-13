/**
 * Shared application state module.
 *
 * Holds the current data array and view callbacks so that table-view.js and
 * edit-view.js can read/mutate state without importing from ui.js, breaking
 * the bidirectional dependency cycle between those modules.
 *
 * ui.js registers the rerender and card-type-getter callbacks during init.
 */

/** @type {Object[]|null} Current loaded CSV rows. */
let _data = null;

/** @type {(function(Object=, Object[]=): Promise<void>)|null} */
let _rerenderFn = null;

/** @type {(function(): Object|null)|null} */
let _getActiveCardTypeFn = null;

// ── Data accessors ───────────────────────────────────────────────────────────

/**
 * Get the current data array.
 * @returns {Object[]|null}
 */
export function getData() { return _data; }

/**
 * Replace the entire data array and schedule a session auto-save.
 * @param {Object[]|null} data
 */
export function setData(data) {
  _data = data;
  _scheduleSave();
}

let _saveTimer = null;
function _scheduleSave() {
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(async () => {
    try {
      const { saveSession } = await import('./storage.js');
      await saveSession();
    } catch { /* storage may not be available in tests */ }
  }, 1000); // debounce: save 1s after last mutation
}

/**
 * Update a single row in the data array.
 * @param {number} index - Row index
 * @param {Object} row - New row data
 */
export function setRowData(index, row) {
  if (_data) _data[index] = row;
}

/**
 * Delete rows at the given indices (processes highest index first).
 * @param {number[]} indices
 */
export function deleteRows(indices) {
  if (!_data) return;
  const sorted = [...indices].sort((a, b) => b - a);
  for (const i of sorted) _data.splice(i, 1);
}

// ── Callback registration ────────────────────────────────────────────────────

/**
 * Register the view rerender function (called once by ui.js during init).
 * @param {function(Object=, Object[]=): Promise<void>} fn
 */
export function registerRerenderFn(fn) { _rerenderFn = fn; }

/**
 * Register the active card type getter (called once by ui.js during init).
 * @param {function(): Object|null} fn
 */
export function registerGetActiveCardTypeFn(fn) { _getActiveCardTypeFn = fn; }

// ── Shared accessors (used by table-view and edit-view) ──────────────────────

/**
 * Get the currently active card type.
 * @returns {Object|null}
 */
export function getActiveCardType() {
  return _getActiveCardTypeFn ? _getActiveCardTypeFn() : null;
}

/**
 * Re-render the active view with optional overrides.
 * Delegates to the registered rerender function in ui.js.
 * @param {Object} [cardType]
 * @param {Object[]} [rows]
 * @returns {Promise<void>}
 */
export function rerenderActiveView(cardType, rows) {
  if (_rerenderFn) return _rerenderFn(cardType, rows);
  return Promise.resolve();
}

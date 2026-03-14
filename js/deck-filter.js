/**
 * Shared filter/search state.
 *
 * Both card view and table view read from this module so switching views
 * preserves the active search query.
 */

/** @type {string} */
let _query = '';

/** Subscribers to notify when filter changes */
const _listeners = new Set();

export function getQuery() {
  return _query;
}

export function setQuery(q) {
  _query = q;
  _listeners.forEach((fn) => fn());
}

export function onFilterChange(fn) {
  _listeners.add(fn);
}
export function offFilterChange(fn) {
  _listeners.delete(fn);
}

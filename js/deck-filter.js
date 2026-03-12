/**
 * Shared filter/search state for the deck bar.
 *
 * Both card view and table view read from this module so switching views
 * preserves the active search query and shows the same summary counts.
 */

import { getData, getActiveCardType } from './state.js';

/** @type {string} */
let _query = '';

/** Subscribers to notify when filter changes */
const _listeners = new Set();

export function getQuery() { return _query; }

export function setQuery(q) {
  _query = q;
  _listeners.forEach(fn => fn());
}

export function onFilterChange(fn) { _listeners.add(fn); }
export function offFilterChange(fn) { _listeners.delete(fn); }

/**
 * Update the deck bar: summary counts + search input + clear button.
 * Call after any data or filter change.
 */
export function updateDeckBar() {
  const deckBar = document.getElementById('deck-bar');
  const summaryEl = document.getElementById('deck-summary');
  const clearBtn = document.getElementById('shared-clear-filters');
  const searchInput = document.getElementById('shared-search');
  if (!deckBar || !summaryEl) return;

  const ct = getActiveCardType?.();
  const data = getData?.();

  if (!ct || (!data && !ct?.sampleData)) {
    deckBar.hidden = true;
    return;
  }

  const rows = data || ct.sampleData;
  deckBar.hidden = false;

  // Build summary: total count + aggregations
  let summary = `${rows.length} card${rows.length !== 1 ? 's' : ''}`;

  if (ct.aggregations?.length > 0) {
    const aggParts = ct.aggregations.map(agg => {
      const matchCount = rows.filter(r => String(r[agg.field] || '') === agg.value).length;
      return `${agg.label}: ${matchCount}`;
    });
    summary += ' · ' + aggParts.join(' · ');
  }

  // Add filtered count if search is active
  if (_query) {
    const matchCount = rows.filter(r =>
      ct.fields.some(f => String(r[f.key] || '').toLowerCase().includes(_query.toLowerCase()))
    ).length;
    summary += ` · Showing ${matchCount} matching`;
  }

  summaryEl.textContent = summary;

  // Keep search input in sync (if user didn't type in it directly)
  if (searchInput && searchInput.value !== _query) searchInput.value = _query;

  // Clear button visibility
  if (clearBtn) clearBtn.hidden = !_query;
}

/**
 * Wire up the deck bar's search input and clear button.
 * Call once from bindEvents().
 */
export function initDeckBar(rerenderFn) {
  const searchInput = document.getElementById('shared-search');
  const clearBtn = document.getElementById('shared-clear-filters');

  let debounce = null;
  searchInput?.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      setQuery(searchInput.value.trim());
      updateDeckBar();
      rerenderFn();
    }, 150);
  });

  clearBtn?.addEventListener('click', () => {
    setQuery('');
    if (searchInput) searchInput.value = '';
    updateDeckBar();
    rerenderFn();
  });

  // Listen for external filter changes (e.g. from table column filters)
  onFilterChange(updateDeckBar);
}

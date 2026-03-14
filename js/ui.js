/**
 * UI module — main orchestration layer.
 *
 * REQ-022: Decomposed from a 777-line monolith into:
 *   js/file-io.js  — CSV loading, saving, FSAPI, downloads
 *   js/sidebar.js  — card type selection, field reference, sidebar toggle
 *   js/ui.js       — view rendering, event binding, keyboard shortcuts (this file)
 */

import * as registry from './card-type-registry.js';
import { renderCard, escapeHtml } from './template-renderer.js';
import { renderTable, getFilteredIndices } from './table-view.js';
import { initEditView, openEditModal } from './edit-view.js';
import { buildPrintLayout, clearPrintLayout } from './print-layout.js';
import { getStarterSchema, getStarterFront, getStarterBack, getStarterCss } from './starter-files.js';

/** Build a starter bundle JSON combining schema + templates + styles. */
function _getStarterBundle() {
  const schema = JSON.parse(getStarterSchema());
  return JSON.stringify(
    {
      ...schema,
      frontTemplate: getStarterFront(),
      backTemplate: getStarterBack(),
      styles: getStarterCss(),
    },
    null,
    2,
  );
}
import { preloadIcons } from './icon-loader.js';
import { createFocusTrap } from './focus-trap.js';
import { setData, getData, registerRerenderFn, registerGetActiveCardTypeFn } from './state.js';
import { createVirtualGrid, VS_THRESHOLD } from './virtual-scroll.js';
import { getQuery } from './deck-filter.js';
import { showToast } from './toast.js';
import {
  hasFSAPI,
  openCsvWithPicker,
  loadCsvFile,
  saveToFile,
  updateSaveState,
  downloadFile,
  clearFileState,
} from './file-io.js';
import {
  openSidebar,
  closeSidebar,
  refreshCardTypeList as _refreshCardTypeList,
  selectCardType as _selectCardType,
} from './sidebar.js';

// ── DOM refs ─────────────────────────────────────────────────────────────────
const cardTypeSelect = document.getElementById('card-type-select');
const csvUpload = document.getElementById('csv-upload');
const openCsvBtn = document.getElementById('open-csv-btn');
const saveBtn = document.getElementById('save-btn');
const cardGrid = document.getElementById('card-grid');
const printBtn = document.getElementById('print-btn');
const showBacksToggle = document.getElementById('show-backs');
const sidebarEl = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');
const customBundle = document.getElementById('custom-bundle');
const customUploadBtn = document.getElementById('custom-upload-btn');
const mainArea = document.getElementById('main-content');

let activeView = 'cards'; // 'cards' | 'table'
let overlayMode = false; // show field data overlaid on cards
let selectMode = false; // card selection mode
const selectedCards = new Set(); // selected card data indices
let _virtualGrid = null; // active VirtualGrid instance (if any)

// ── Public re-exports (backward compat) ──────────────────────────────────────
export { getData, setRowData, deleteRows } from './state.js';
export { showToast } from './toast.js';
export { downloadFile } from './file-io.js';

export function getActiveCardType() {
  return registry.get(cardTypeSelect.value);
}

export function refreshCardTypeList() {
  _refreshCardTypeList();
}

export function autoSelect(id) {
  cardTypeSelect.value = id;
  _selectCardType(id, renderCards, renderEmpty);
}

// ── View rendering ────────────────────────────────────────────────────────────

/**
 * Re-render the currently active view (cards or table).
 * @param {Object} [cardType]
 * @param {Object[]} [rows]
 */
export async function rerenderActiveView(cardType, rows) {
  if (!cardType) cardType = getActiveCardType();
  if (!rows) rows = getData() || cardType?.sampleData;
  if (!cardType || !rows) return;

  // Show Add Card button only when real (non-sample) data is loaded
  const addBtn = document.getElementById('add-card-btn');
  if (addBtn) addBtn.hidden = !getData();

  if (activeView === 'table') {
    renderTable(cardType, rows);
  } else {
    const filtered = getFilteredIndices();
    await renderCards(cardType, rows, filtered);
  }
}

/**
 * Collect icon field values from rows for preloading.
 */
function collectIconValues(fields, rows) {
  return fields
    .filter((f) => f.type === 'icon')
    .flatMap((f) => rows.map((r) => r[f.key]).filter((v) => v && typeof v === 'string'));
}

/**
 * Render the card grid. REQ-051: loading indicator. REQ-060: add-card button.
 * REQ-071: uses virtual scrolling for decks larger than VS_THRESHOLD cards.
 */
export async function renderCards(cardType, rows, filteredIndices) {
  const indices = filteredIndices || rows.map((_, i) => i);

  // Tear down any previous virtual grid
  if (_virtualGrid) {
    _virtualGrid.destroy();
    _virtualGrid = null;
  }

  cardGrid.innerHTML = '';
  cardGrid.classList.remove('empty-state');
  cardGrid.setAttribute('role', 'list');
  cardGrid.setAttribute('aria-label', 'Card deck');

  // REQ-051: loading indicator during icon preload
  const iconValues = collectIconValues(
    cardType.fields,
    indices.map((i) => rows[i]),
  );
  if (iconValues.length > 0) {
    const loader = document.createElement('div');
    loader.className = 'loading-indicator';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.textContent = 'Loading icons…';
    cardGrid.appendChild(loader);
    await preloadIcons(iconValues);
    loader.remove();
  }

  const showBacks = showBacksToggle.checked && !!cardType.backTemplate;
  const width = cardType.cardSize?.width || '63.5mm';
  const height = cardType.cardSize?.height || '88.9mm';

  // REQ-071: virtual scrolling for large decks
  if (indices.length >= VS_THRESHOLD) {
    _virtualGrid = createVirtualGrid(cardGrid, {
      cardType,
      rows,
      filteredIndices: indices,
      showBacks,
      overlayMode,
      onEditCard: (idx, btn) => openEditModal(idx, btn),
      renderCardHtml: renderCard,
    });
    return;
  }

  // Apply shared search filter (REQ-065)
  const q = getQuery().toLowerCase();
  const displayIndices = q
    ? indices.filter((i) =>
        cardType.fields.some((f) =>
          String(rows[i][f.key] || '')
            .toLowerCase()
            .includes(q),
        ),
      )
    : indices;

  for (const idx of displayIndices) {
    const row = rows[idx];
    const pair = document.createElement('div');
    pair.className = 'card-pair';
    if (selectMode && selectedCards.has(idx)) pair.classList.add('selected');
    pair.setAttribute('role', 'listitem');

    const frontWrapper = document.createElement('div');
    frontWrapper.className = 'card-wrapper';
    frontWrapper.style.width = width;
    frontWrapper.style.height = height;
    frontWrapper.dataset.cardType = cardType.id;
    frontWrapper.innerHTML = renderCard(cardType.frontTemplate, row, cardType.fields, cardType);
    pair.appendChild(frontWrapper);

    if (showBacks && cardType.backTemplate) {
      const backWrapper = document.createElement('div');
      backWrapper.className = 'card-wrapper card-back-wrapper';
      backWrapper.style.width = width;
      backWrapper.style.height = height;
      backWrapper.dataset.cardType = cardType.id;
      backWrapper.innerHTML = renderCard(cardType.backTemplate, row, cardType.fields, cardType);
      pair.appendChild(backWrapper);
    }

    // Overlay: show field data on top of card when overlay mode is active
    if (overlayMode) {
      const overlay = document.createElement('div');
      overlay.className = 'card-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      const lines = cardType.fields
        .filter((f) => row[f.key] && String(row[f.key]).trim())
        .slice(0, 6)
        .map(
          (f) =>
            `<div class="overlay-field"><span class="overlay-label">${escapeHtml(f.label)}</span><span class="overlay-value">${escapeHtml(String(row[f.key]).slice(0, 40))}</span></div>`,
        )
        .join('');
      overlay.innerHTML = lines;
      frontWrapper.appendChild(overlay);
    }

    // Selection checkbox (visible in select mode)
    if (selectMode) {
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.className = 'card-select-cb';
      cb.checked = selectedCards.has(idx);
      cb.setAttribute('aria-label', `Select card ${idx + 1}`);
      cb.addEventListener('change', () => {
        if (cb.checked) selectedCards.add(idx);
        else selectedCards.delete(idx);
        pair.classList.toggle('selected', cb.checked);
        _updateCardSelectionBar();
      });
      pair.appendChild(cb);
    }

    // Edit button rendered inside the card front (hover to reveal)
    const editBtn = document.createElement('button');
    editBtn.className = 'card-edit-btn';
    editBtn.textContent = '\u270E';
    editBtn.title = 'Edit this card';
    editBtn.setAttribute('aria-label', `Edit card ${idx + 1}`);
    editBtn.addEventListener('click', (e) => {
      if (selectMode) {
        const cb = pair.querySelector('.card-select-cb');
        if (cb) {
          cb.checked = !cb.checked;
          cb.dispatchEvent(new Event('change'));
        }
        return;
      }
      openEditModal(idx, e.currentTarget);
    });
    frontWrapper.appendChild(editBtn);

    cardGrid.appendChild(pair);
  }

  if (displayIndices.length === 0 && !getData()) renderEmpty();
}

/**
 * Update card selection bar counts and button states.
 */
function _updateCardSelectionBar() {
  const countEl = document.getElementById('card-selected-count');
  const bulkBtn = document.getElementById('bulk-edit-btn');
  const n = selectedCards.size;
  if (countEl) countEl.textContent = `${n} selected`;
  if (bulkBtn) bulkBtn.disabled = n === 0;
}

/**
 * Open the bulk-edit modal for selected cards.
 */
function openBulkEditModal() {
  const ct = getActiveCardType();
  const data = getData() || ct?.sampleData;
  if (!ct || !data || selectedCards.size === 0) return;

  const modal = document.getElementById('bulk-edit-modal');
  const fieldsEl = document.getElementById('bulk-edit-fields');
  if (!modal || !fieldsEl) return;

  fieldsEl.innerHTML = '';
  for (const field of ct.fields) {
    if (field.type === 'icon') continue; // skip icon fields in bulk edit

    const row = document.createElement('div');
    row.className = 'edit-field-row';

    const label = document.createElement('label');
    label.className = 'edit-field-label';
    label.textContent = field.label || field.key;
    row.appendChild(label);

    let input;
    if (field.type === 'select' && field.options) {
      input = document.createElement('select');
      input.className = 'edit-field-input';
      input.dataset.fieldKey = field.key;
      const blank = document.createElement('option');
      blank.value = '';
      blank.textContent = '— leave unchanged —';
      input.appendChild(blank);
      for (const opt of field.options) {
        const o = document.createElement('option');
        o.value = opt;
        o.textContent = opt;
        input.appendChild(o);
      }
    } else if (field.type === 'multi-select' && field.options) {
      // Show as a compact checkbox list
      const wrap = document.createElement('div');
      wrap.className = 'bulk-ms-wrap';
      wrap.dataset.fieldKey = field.key;
      wrap.dataset.fieldType = 'multi-select';
      const none = document.createElement('label');
      none.className = 'bulk-ms-none';
      none.innerHTML = '<input type="radio" name="bms_' + field.key + '" value="" checked> leave unchanged';
      wrap.appendChild(none);
      for (const opt of field.options) {
        const lbl = document.createElement('label');
        lbl.innerHTML = `<input type="checkbox" name="bms_${field.key}" value="${opt}" disabled> ${opt}`;
        wrap.appendChild(lbl);
      }
      none.querySelector('input').addEventListener('change', () => {
        wrap.querySelectorAll('input[type=checkbox]').forEach((c) => {
          c.disabled = true;
          c.checked = false;
        });
      });
      const setBtn = document.createElement('label');
      setBtn.innerHTML = `<input type="radio" name="bms_${field.key}" value="set"> Set to:`;
      setBtn.querySelector('input').addEventListener('change', () => {
        wrap.querySelectorAll('input[type=checkbox]').forEach((c) => {
          c.disabled = false;
        });
      });
      wrap.appendChild(setBtn);
      row.appendChild(wrap);
      fieldsEl.appendChild(row);
      continue;
    } else if (field.type === 'text-long') {
      input = document.createElement('textarea');
      input.className = 'edit-field-input';
      input.rows = 2;
      input.dataset.fieldKey = field.key;
      input.placeholder = 'Leave blank to keep existing value';
    } else {
      input = document.createElement('input');
      input.type = field.type === 'number' ? 'number' : 'text';
      input.className = 'edit-field-input';
      input.dataset.fieldKey = field.key;
      input.placeholder = 'Leave blank to keep existing value';
    }
    row.appendChild(input);
    fieldsEl.appendChild(row);
  }

  modal.hidden = false;
  modal.querySelector('#bulk-edit-save').dataset.cardType = ct.id;
}

function closeBulkEditModal() {
  const modal = document.getElementById('bulk-edit-modal');
  if (modal) modal.hidden = true;
}

function applyBulkEdit() {
  const ct = getActiveCardType();
  const data = getData();
  if (!ct || !data || selectedCards.size === 0) {
    closeBulkEditModal();
    return;
  }

  const modal = document.getElementById('bulk-edit-modal');
  const updates = {};

  // Collect plain input fields
  modal.querySelectorAll('[data-field-key]').forEach((el) => {
    if (el.dataset.fieldType === 'multi-select') return; // handled below
    const val = el.value?.trim();
    if (val) updates[el.dataset.fieldKey] = val;
  });

  // Collect multi-select fields
  modal.querySelectorAll('.bulk-ms-wrap').forEach((wrap) => {
    const setRadio = wrap.querySelector('input[type=radio][value=set]');
    if (!setRadio?.checked) return;
    const chosen = [...wrap.querySelectorAll('input[type=checkbox]:checked')].map((c) => c.value);
    const fieldDef = ct.fields.find((f) => f.key === wrap.dataset.fieldKey);
    const sep = fieldDef?.separator || '|';
    if (chosen.length > 0) updates[wrap.dataset.fieldKey] = chosen.join(sep);
  });

  if (Object.keys(updates).length === 0) {
    showToast('No fields filled in — nothing changed.', 'error');
    return;
  }

  // Apply updates to selected rows
  const newData = data.map((row, i) => {
    if (!selectedCards.has(i)) return row;
    return { ...row, ...updates };
  });

  setData(newData);
  showToast(`Updated ${selectedCards.size} card${selectedCards.size !== 1 ? 's' : ''}.`, 'success');
  closeBulkEditModal();
  rerenderActiveView(ct, newData);
}

/**
 * Render the improved empty state (REQ-052).
 */
function renderEmpty() {
  const ct = getActiveCardType();
  const hasSample = ct?.sampleData?.length > 0;

  cardGrid.innerHTML = `
    <div class="empty-state">
      <div class="empty-state-icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect x="8" y="12" width="30" height="42" rx="4" fill="#e8eef7" stroke="#4a6fa5" stroke-width="2"/>
          <rect x="18" y="8" width="30" height="42" rx="4" fill="#f5f8ff" stroke="#4a6fa5" stroke-width="2"/>
          <line x1="24" y1="22" x2="40" y2="22" stroke="#4a6fa5" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="24" y1="28" x2="40" y2="28" stroke="#b0bdd6" stroke-width="1.5" stroke-linecap="round"/>
          <line x1="24" y1="34" x2="34" y2="34" stroke="#b0bdd6" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
      </div>
      <h2 class="empty-state-title">Ready to make some cards?</h2>
      <p class="empty-state-desc">Select a card type, then open a CSV to load your data.</p>
      ${hasSample ? `<button class="btn btn-primary empty-state-try-btn" id="empty-try-btn">▶ Try with sample data</button>` : ''}
      <p class="empty-state-hint">
        Drag a CSV file anywhere on this area to load it. &nbsp;
        <a href="docs/card-type-authoring.md" target="_blank" class="help-link">How to create custom card types →</a>
      </p>
    </div>`;

  const tryBtn = cardGrid.querySelector('#empty-try-btn');
  if (tryBtn && ct) tryBtn.addEventListener('click', () => rerenderActiveView(ct, ct.sampleData));
}

// ── Event binding ─────────────────────────────────────────────────────────────

export function bindEvents() {
  // Register state.js callbacks (breaks table-view/edit-view → ui.js dep)
  registerRerenderFn((ct, rows) => rerenderActiveView(ct, rows));
  registerGetActiveCardTypeFn(() => registry.get(cardTypeSelect.value));

  // Sidebar toggle (mobile)
  sidebarToggleBtn.addEventListener('click', () =>
    sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar(),
  );
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Card type selection
  cardTypeSelect.addEventListener('change', (e) => {
    // Don't clear file state during programmatic session restore
    if (!e._fromRestore) clearFileState();
    _selectCardType(cardTypeSelect.value, renderCards, renderEmpty);
  });

  // Open CSV
  openCsvBtn.addEventListener('click', () => openCsvWithPicker(csvUpload));
  csvUpload.addEventListener('change', async () => {
    const file = csvUpload.files[0];
    if (!file) return;
    await loadCsvFile(file, file.name);
  });

  // Save
  saveBtn.addEventListener('click', () => saveToFile());

  // Keyboard shortcuts (REQ-053)
  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (getData()) saveToFile();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      printBtn.click();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const target = document.querySelector('.table-global-filter');
      target?.focus();
      target?.select?.();
      return;
    }
    if (e.key === '?' && !inInput) {
      e.preventDefault();
      showShortcutsModal();
    }
  });

  // Show/hide backs
  showBacksToggle.addEventListener('change', () => {
    const ct = getActiveCardType();
    if (!ct) return;
    rerenderActiveView(ct, getData() || ct.sampleData);
  });

  // View toggle (Cards / Table)
  const viewBtns = document.querySelectorAll('.view-btn');
  const tableViewEl = document.getElementById('table-view');
  viewBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === activeView) return;
      activeView = view;
      viewBtns.forEach((b) => b.classList.toggle('active', b.dataset.view === view));
      cardGrid.hidden = view !== 'cards';
      tableViewEl.hidden = view !== 'table';
      const ct = getActiveCardType();
      const data = getData() || ct?.sampleData;
      if (ct && data) rerenderActiveView(ct, data);
    });
  });

  // Card grid size toggle (comfortable / compact)
  const sizeBtns = document.querySelectorAll('.size-btn');
  sizeBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const size = btn.dataset.size;
      sizeBtns.forEach((b) => b.classList.toggle('active', b.dataset.size === size));
      cardGrid.dataset.density = size;
      // Re-render so virtual grid recalculates column counts
      const ct = getActiveCardType();
      const data = getData() || ct?.sampleData;
      if (ct && data && activeView === 'cards') rerenderActiveView(ct, data);
    });
  });

  // Bulk edit modal
  document.getElementById('bulk-edit-close')?.addEventListener('click', closeBulkEditModal);
  document.getElementById('bulk-edit-cancel')?.addEventListener('click', closeBulkEditModal);
  document.getElementById('bulk-edit-save')?.addEventListener('click', applyBulkEdit);

  // Add Card (header button)
  const addCardBtn = document.getElementById('add-card-btn');
  if (addCardBtn) {
    addCardBtn.addEventListener('click', () => {
      const ct = getActiveCardType();
      const data = getData();
      if (!ct || !data) return;
      const emptyRow = {};
      for (const f of ct.fields) emptyRow[f.key] = '';
      data.push(emptyRow);
      setData(data);
      openEditModal(data.length - 1, addCardBtn);
    });
  }

  // Overlay toggle
  const overlayBtn = document.getElementById('overlay-toggle-btn');
  if (overlayBtn) {
    overlayBtn.addEventListener('click', () => {
      overlayMode = !overlayMode;
      overlayBtn.setAttribute('aria-pressed', String(overlayMode));
      overlayBtn.classList.toggle('active', overlayMode);
      cardGrid.classList.toggle('overlay-mode', overlayMode);
      const ct = getActiveCardType();
      const data = getData() || ct?.sampleData;
      if (ct && data && activeView === 'cards') rerenderActiveView(ct, data);
    });
  }

  // Print
  printBtn.addEventListener('click', () => {
    const ct = getActiveCardType();
    const data = getData() || ct?.sampleData;
    if (!ct || !data) {
      showToast('No cards to print.', 'error');
      return;
    }
    const rows = (getFilteredIndices() || data.map((_, i) => i)).map((i) => data[i]);
    const pageCount = Math.ceil(rows.length / 9);

    if (pageCount <= 3) {
      // Small deck: render synchronously, print immediately
      buildPrintLayout(ct, rows);
      window.print();
    } else {
      // Large deck: show progress, wait for layout to finish before printing
      showToast(`Preparing ${pageCount} print pages…`, 'info', 15000);
      buildPrintLayout(ct, rows, (pct) => {
        if (pct >= 100) {
          showToast('Print layout ready.', 'success', 2000);
          window.print();
        }
      });
    }
  });
  window.addEventListener('afterprint', clearPrintLayout);

  // Edit view
  initEditView();

  // Starter bundle download
  document.querySelector('.custom-upload-group')?.addEventListener('click', (e) => {
    if (!e.target.matches('.starter-link[data-starter="bundle"]')) return;
    e.preventDefault();
    downloadFile('card-type-bundle.json', _getStarterBundle(), 'application/json');
  });

  // File name display
  customBundle?.addEventListener('change', () => {
    const nameEl = document.getElementById('custom-file-name');
    if (nameEl) nameEl.textContent = customBundle.files[0]?.name || 'No file chosen';
  });

  // Download current card type as bundle
  document.getElementById('custom-download-btn')?.addEventListener('click', () => {
    const ct = getActiveCardType();
    if (!ct) {
      showToast('No card type selected.', 'error');
      return;
    }
    const bundle = {
      id: ct.id,
      name: ct.name,
      description: ct.description || '',
      cardSize: ct.cardSize,
      fields: ct.fields,
      frontTemplate: ct.frontTemplate,
      backTemplate: ct.backTemplate || '',
      styles: ct.styles || ct.css || '',
      aggregations: ct.aggregations || [],
      colorMapping: ct.colorMapping || {},
    };
    downloadFile(`${ct.id}-bundle.json`, JSON.stringify(bundle, null, 2), 'application/json');
  });

  // Drag-and-drop CSV (REQ-050)
  mainArea.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      mainArea.classList.add('drag-over');
    }
  });
  mainArea.addEventListener('dragenter', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      mainArea.classList.add('drag-over');
    }
  });
  mainArea.addEventListener('dragleave', (e) => {
    if (!mainArea.contains(e.relatedTarget)) mainArea.classList.remove('drag-over');
  });
  mainArea.addEventListener('drop', async (e) => {
    e.preventDefault();
    mainArea.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'tsv', 'txt'].includes(ext)) {
      showToast('Please drop a CSV, TSV, or TXT file.', 'error');
      return;
    }
    await loadCsvFile(file, file.name);
  });

  // FSAPI vs fallback input
  if (hasFSAPI) csvUpload.style.display = 'none';
  else openCsvBtn.style.display = 'none';

  // Custom card type upload (single bundle JSON)
  customUploadBtn?.addEventListener('click', async () => {
    const file = customBundle?.files[0];
    if (!file) {
      showToast('Please choose a card type JSON file.', 'error');
      return;
    }
    try {
      const text = await file.text();
      const bundle = JSON.parse(text);
      const ct = await registry.registerFromBundle(bundle);
      _refreshCardTypeList();
      cardTypeSelect.value = ct.id;
      _selectCardType(ct.id, renderCards, renderEmpty);
      showToast(`Loaded card type: ${ct.name}`, 'success');
      if (customBundle) {
        customBundle.value = '';
      }
      const nameEl = document.getElementById('custom-file-name');
      if (nameEl) nameEl.textContent = 'No file chosen';
    } catch (err) {
      showToast(err.message, 'error', 6000);
    }
  });

  // Export menu toggle
  const exportMenuBtn = document.getElementById('export-menu-btn');
  const exportMenu = document.getElementById('export-menu');
  if (exportMenuBtn && exportMenu) {
    exportMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = !exportMenu.hidden;
      exportMenu.hidden = open;
      exportMenuBtn.setAttribute('aria-expanded', String(!open));
    });
    document.addEventListener('click', () => {
      if (!exportMenu.hidden) {
        exportMenu.hidden = true;
        exportMenuBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // Dark mode toggle (REQ-054)
  const darkBtn = document.getElementById('dark-mode-toggle');
  if (darkBtn) {
    const stored = localStorage.getItem('card-maker-theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false;
    // Apply: explicit pref wins; fall back to OS preference
    if (stored === 'dark' || (!stored && prefersDark)) {
      document.documentElement.classList.add('dark');
      darkBtn.textContent = '☀️';
    }
    darkBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('card-maker-theme', isDark ? 'dark' : 'light');
      darkBtn.textContent = isDark ? '☀️' : '🌙';
    });
  }

  // Deck import/export (REQ-064)
  document.getElementById('export-deck-btn')?.addEventListener('click', exportDeck);
  document.getElementById('import-deck-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importDeck(file);
    e.target.value = '';
  });

  // PNG export (REQ-063)
  document.getElementById('export-png-btn')?.addEventListener('click', exportCardsPng);

  updateSaveState();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function showShortcutsModal() {
  const existing = document.getElementById('shortcuts-modal');
  if (existing) {
    existing.remove();
    return;
  }

  const modal = document.createElement('div');
  modal.id = 'shortcuts-modal';
  modal.className = 'shortcuts-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-label', 'Keyboard shortcuts');
  modal.innerHTML = `
    <div class="shortcuts-panel">
      <div class="shortcuts-header">
        <h2>Keyboard Shortcuts</h2>
        <button class="btn edit-close-btn" id="shortcuts-close" aria-label="Close">&times;</button>
      </div>
      <table class="shortcuts-table"><tbody>
        <tr><td><kbd>Ctrl+S</kbd></td><td>Save / download CSV</td></tr>
        <tr><td><kbd>Ctrl+P</kbd></td><td>Print / PDF</td></tr>
        <tr><td><kbd>Ctrl+F</kbd></td><td>Focus search / filter</td></tr>
        <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo last edit</td></tr>
        <tr><td><kbd>Ctrl+Shift+Z</kbd></td><td>Redo</td></tr>
        <tr><td><kbd>Escape</kbd></td><td>Close dialog / cancel edit</td></tr>
        <tr><td><kbd>Enter</kbd></td><td>Edit focused table cell</td></tr>
        <tr><td><kbd>↑ ↓ ← →</kbd></td><td>Navigate table cells</td></tr>
        <tr><td><kbd>?</kbd></td><td>Show / hide this panel</td></tr>
      </tbody></table>
    </div>`;
  document.body.appendChild(modal);

  const panel = modal.querySelector('.shortcuts-panel');
  const trap = createFocusTrap(panel);
  trap.activate();

  function closeShortcutsModal() {
    trap.deactivate();
    modal.remove();
  }

  modal.querySelector('#shortcuts-close').addEventListener('click', closeShortcutsModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeShortcutsModal();
  });
  document.addEventListener('keydown', function h(e) {
    if (e.key === 'Escape') {
      closeShortcutsModal();
      document.removeEventListener('keydown', h);
    }
  });
}

// ── REQ-064: Deck import / export ─────────────────────────────────────────────

/**
 * Export the current card type + data as a single .cardmaker JSON file.
 */
export function exportDeck() {
  const ct = getActiveCardType();
  const data = getData();
  if (!ct) {
    showToast('No card type selected.', 'error');
    return;
  }

  const deck = {
    version: 1,
    id: ct.id,
    name: ct.name,
    description: ct.description,
    cardSize: ct.cardSize,
    fields: ct.fields,
    colorMapping: ct.colorMapping,
    frontTemplate: ct.frontTemplate,
    backTemplate: ct.backTemplate,
    css: ct.css,
    data: data || ct.sampleData || [],
    exportedAt: new Date().toISOString(),
  };

  downloadFile(`${ct.id}-deck.cardmaker`, JSON.stringify(deck, null, 2), 'application/json');
  showToast('Deck exported.', 'success');
}

/**
 * Import a .cardmaker deck file, registering its card type and loading its data.
 * @param {File} file
 */
export async function importDeck(file) {
  try {
    const text = await file.text();
    const deck = JSON.parse(text);

    if (!deck.id || !deck.fields || !deck.frontTemplate) {
      throw new Error('Invalid deck file — missing required fields.');
    }

    // Re-register the card type from the embedded templates
    const ct = {
      id: deck.id,
      name: deck.name || deck.id,
      description: deck.description || '',
      cardSize: deck.cardSize || { width: '63.5mm', height: '88.9mm' },
      fields: deck.fields,
      colorMapping: deck.colorMapping || null,
      aggregations: null,
      frontTemplate: deck.frontTemplate,
      backTemplate: deck.backTemplate || null,
      css: deck.css || '',
      sampleData: null,
    };

    // Use the registry's internal register via registerFromUpload equivalent
    // We rebuild File objects so the registry path is used consistently
    const schemaObj = {
      id: ct.id,
      name: ct.name,
      description: ct.description,
      cardSize: ct.cardSize,
      fields: ct.fields,
      colorMapping: ct.colorMapping,
      aggregations: ct.aggregations,
    };
    await registry.registerFromUpload(
      new File([JSON.stringify(schemaObj)], 'card-type.json'),
      new File([ct.frontTemplate], 'front.html'),
      ct.backTemplate ? new File([ct.backTemplate], 'back.html') : null,
      ct.css ? new File([ct.css], 'style.css') : null,
    );

    _refreshCardTypeList();
    cardTypeSelect.value = ct.id;

    if (deck.data && deck.data.length > 0) {
      setData(deck.data);
      rerenderActiveView(registry.get(ct.id), deck.data);
      updateSaveState();
    } else {
      _selectCardType(ct.id, renderCards, renderEmpty);
    }

    showToast(`Imported "${ct.name}" (${(deck.data || []).length} cards).`, 'success');
  } catch (err) {
    showToast('Import failed: ' + err.message, 'error', 6000);
  }
}

// ── REQ-063: PNG export ───────────────────────────────────────────────────────

/**
 * Export all visible cards as PNG images in a ZIP file.
 * Uses html-to-image for rendering and JSZip for packaging.
 */
async function exportCardsPng() {
  const ct = getActiveCardType();
  const data = getData() || ct?.sampleData;
  if (!ct || !data) {
    showToast('No cards to export.', 'error');
    return;
  }

  // Dynamically import heavy libraries at call time.
  // @vite-ignore suppresses Vite's static analysis warning without breaking CSP.
  let htmlToImage, JSZip;
  try {
    [{ default: htmlToImage }, { default: JSZip }] = await Promise.all([
      import(/* @vite-ignore */ 'html-to-image'),
      import(/* @vite-ignore */ 'jszip'),
    ]);
  } catch {
    showToast('PNG export requires html-to-image and jszip. Run: npm install html-to-image jszip', 'error', 8000);
    return;
  }

  showToast('Generating PNGs…', 'info', 30000);

  const zip = new JSZip();
  const filtered = getFilteredIndices();
  const indices = filtered || data.map((_, i) => i);

  // Render each card in a hidden off-screen container
  const offscreen = document.createElement('div');
  offscreen.style.cssText = 'position:fixed;left:-9999px;top:0;';
  document.body.appendChild(offscreen);

  const width = ct.cardSize?.width || '63.5mm';
  const height = ct.cardSize?.height || '88.9mm';

  try {
    for (let i = 0; i < indices.length; i++) {
      const idx = indices[i];
      const wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';
      wrapper.dataset.cardType = ct.id;
      wrapper.style.width = width;
      wrapper.style.height = height;
      wrapper.style.overflow = 'hidden';
      wrapper.innerHTML = renderCard(ct.frontTemplate, data[idx], ct.fields, ct);
      offscreen.innerHTML = '';
      offscreen.appendChild(wrapper);

      // Wait a frame for CSS to apply
      await new Promise((r) => requestAnimationFrame(r));

      const dataUrl = await htmlToImage.toPng(wrapper, { pixelRatio: 2 });
      const base64 = dataUrl.split(',')[1];
      const firstField = ct.fields[0];
      const label = (data[idx][firstField?.key] || `card-${idx + 1}`).replace(/[^a-z0-9_-]/gi, '-').slice(0, 40);
      zip.file(`${String(i + 1).padStart(3, '0')}-${label}.png`, base64, { base64: true });
    }

    const blob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ct.id}-cards.zip`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Exported ${indices.length} card(s) as PNG.`, 'success');
  } finally {
    offscreen.remove();
  }
}

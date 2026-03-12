/**
 * UI module — main orchestration layer.
 *
 * REQ-022: Decomposed from a 777-line monolith into:
 *   js/file-io.js  — CSV loading, saving, FSAPI, downloads
 *   js/sidebar.js  — card type selection, field reference, sidebar toggle
 *   js/ui.js       — view rendering, event binding, keyboard shortcuts (this file)
 */

import * as registry from './card-type-registry.js';
import { renderCard } from './template-renderer.js';
import { renderTable, getFilteredIndices } from './table-view.js';
import { initEditView, openEditModal } from './edit-view.js';
import { buildPrintLayout, clearPrintLayout } from './print-layout.js';
import { getStarterSchema, getStarterFront, getStarterBack, getStarterCss } from './starter-files.js';
import { preloadIcons } from './icon-loader.js';
import { setData, getData, registerRerenderFn, registerGetActiveCardTypeFn } from './state.js';
import { showToast } from './toast.js';
import {
  hasFSAPI, openCsvWithPicker, loadCsvFile, saveToFile,
  updateSaveState, downloadFile, clearFileState,
} from './file-io.js';
import {
  openSidebar, closeSidebar, refreshCardTypeList as _refreshCardTypeList,
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
const customSchema = document.getElementById('custom-schema');
const customFront = document.getElementById('custom-front');
const customBack = document.getElementById('custom-back');
const customCss = document.getElementById('custom-css');
const customUploadBtn = document.getElementById('custom-upload-btn');

let activeView = 'cards'; // 'cards' | 'table'

// ── Public re-exports (backward compat) ──────────────────────────────────────
export { getData, setRowData, deleteRows } from './state.js';
export { showToast } from './toast.js';
export { downloadFile } from './file-io.js';

export function getActiveCardType() { return registry.get(cardTypeSelect.value); }

export function refreshCardTypeList() { _refreshCardTypeList(); }

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
    .filter(f => f.type === 'icon')
    .flatMap(f => rows.map(r => r[f.key]).filter(v => v && typeof v === 'string'));
}

/**
 * Render the card grid. REQ-051: loading indicator. REQ-060: add-card button.
 */
export async function renderCards(cardType, rows, filteredIndices) {
  const indices = filteredIndices || rows.map((_, i) => i);

  cardGrid.innerHTML = '';
  cardGrid.classList.remove('empty-state');
  cardGrid.setAttribute('role', 'list');
  cardGrid.setAttribute('aria-label', 'Card deck');

  // REQ-051: loading indicator during icon preload
  const iconValues = collectIconValues(cardType.fields, indices.map(i => rows[i]));
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

  // Apply card-view search filter (REQ-065)
  const searchInput = document.getElementById('card-search-input');
  const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const displayIndices = q
    ? indices.filter(i => cardType.fields.some(f => String(rows[i][f.key] || '').toLowerCase().includes(q)))
    : indices;

  for (const idx of displayIndices) {
    const row = rows[idx];
    const pair = document.createElement('div');
    pair.className = 'card-pair';
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

    const editBtn = document.createElement('button');
    editBtn.className = 'card-edit-btn';
    editBtn.textContent = '\u270E';
    editBtn.title = 'Edit this card';
    editBtn.setAttribute('aria-label', `Edit card ${idx + 1}`);
    editBtn.addEventListener('click', (e) => openEditModal(idx, e.currentTarget));
    pair.appendChild(editBtn);

    cardGrid.appendChild(pair);
  }

  // REQ-060: add-card button (only when real data is loaded, not sample)
  const liveData = getData();
  if (liveData) {
    const addPair = document.createElement('div');
    addPair.className = 'card-pair card-pair-add';
    addPair.setAttribute('role', 'listitem');

    const addBtn = document.createElement('button');
    addBtn.className = 'card-add-btn';
    addBtn.style.width = width;
    addBtn.style.height = height;
    addBtn.setAttribute('aria-label', 'Add new card');
    addBtn.innerHTML = '<span class="card-add-icon">+</span><span class="card-add-label">Add card</span>';
    addBtn.addEventListener('click', () => {
      const emptyRow = {};
      for (const f of cardType.fields) emptyRow[f.key] = '';
      liveData.push(emptyRow);
      setData(liveData);
      openEditModal(liveData.length - 1, addBtn);
    });
    addPair.appendChild(addBtn);
    cardGrid.appendChild(addPair);
  }

  if (displayIndices.length === 0 && !getData()) renderEmpty();
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
    sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar()
  );
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Card type selection
  cardTypeSelect.addEventListener('change', () => {
    clearFileState();
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
      e.preventDefault(); if (getData()) saveToFile(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault(); printBtn.click(); return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      const target = activeView === 'table'
        ? document.querySelector('.table-global-filter')
        : document.getElementById('card-search-input');
      target?.focus(); target?.select?.();
      return;
    }
    if (e.key === '?' && !inInput) { e.preventDefault(); showShortcutsModal(); }
  });

  // Show/hide backs
  showBacksToggle.addEventListener('change', () => {
    const ct = getActiveCardType();
    if (!ct) return;
    rerenderActiveView(ct, getData() || ct.sampleData);
  });

  // View toggle
  const viewBtns = document.querySelectorAll('.view-btn');
  const tableViewEl = document.getElementById('table-view');
  viewBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view === activeView) return;
      activeView = view;
      viewBtns.forEach(b => b.classList.toggle('active', b.dataset.view === view));
      cardGrid.hidden = view !== 'cards';
      tableViewEl.hidden = view !== 'table';
      updateCardSearchVisibility();
      const ct = getActiveCardType();
      const data = getData() || ct?.sampleData;
      if (ct && data) rerenderActiveView(ct, data);
    });
  });

  // Print
  printBtn.addEventListener('click', () => {
    const ct = getActiveCardType();
    const data = getData() || ct?.sampleData;
    if (!ct || !data) { showToast('No cards to print.', 'error'); return; }
    const filtered = getFilteredIndices();
    buildPrintLayout(ct, filtered ? filtered.map(i => data[i]) : data);
    window.print();
  });
  window.addEventListener('afterprint', clearPrintLayout);

  // Edit view
  initEditView();

  // Starter downloads
  document.querySelector('.custom-upload-group').addEventListener('click', (e) => {
    if (!e.target.matches('.starter-link')) return;
    e.preventDefault();
    const starters = {
      schema: { fn: getStarterSchema, name: 'card-type.json', mime: 'application/json' },
      front:  { fn: getStarterFront,  name: 'front.html',     mime: 'text/html' },
      back:   { fn: getStarterBack,   name: 'back.html',      mime: 'text/html' },
      css:    { fn: getStarterCss,    name: 'style.css',       mime: 'text/css' },
    };
    const s = starters[e.target.dataset.starter];
    if (s) downloadFile(s.name, s.fn(), s.mime);
  });

  // Card search bar (REQ-065)
  const mainArea = document.getElementById('main-content');
  const cardSearchBar = document.createElement('div');
  cardSearchBar.className = 'card-search-bar';
  cardSearchBar.hidden = true;
  cardSearchBar.innerHTML = `<input id="card-search-input" type="search" class="card-search-input" placeholder="Search cards…" aria-label="Search cards">`;
  mainArea.insertBefore(cardSearchBar, cardGrid);

  let searchDebounce = null;
  cardSearchBar.querySelector('#card-search-input').addEventListener('input', () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(() => {
      const ct = getActiveCardType();
      const data = getData() || ct?.sampleData;
      if (ct && data) renderCards(ct, data, getFilteredIndices() || undefined);
    }, 150);
  });

  // Drag-and-drop CSV (REQ-050)
  mainArea.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); mainArea.classList.add('drag-over'); }
  });
  mainArea.addEventListener('dragenter', (e) => {
    if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); mainArea.classList.add('drag-over'); }
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
      showToast('Please drop a CSV, TSV, or TXT file.', 'error'); return;
    }
    await loadCsvFile(file, file.name);
  });

  // FSAPI vs fallback input
  if (hasFSAPI) csvUpload.style.display = 'none';
  else openCsvBtn.style.display = 'none';

  // Custom card type upload
  customUploadBtn.addEventListener('click', async () => {
    if (!customSchema.files[0]) { showToast('Please provide a schema JSON file.', 'error'); return; }
    if (!customFront.files[0]) { showToast('Please provide a front template HTML file.', 'error'); return; }
    try {
      const ct = await registry.registerFromUpload(
        customSchema.files[0], customFront.files[0],
        customBack.files[0] || null, customCss.files[0] || null
      );
      _refreshCardTypeList();
      cardTypeSelect.value = ct.id;
      _selectCardType(ct.id, renderCards, renderEmpty);
      showToast(`Registered card type: ${ct.name}`, 'success');
      customSchema.value = ''; customFront.value = ''; customBack.value = ''; customCss.value = '';
    } catch (err) { showToast(err.message, 'error', 6000); }
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
      if (!exportMenu.hidden) { exportMenu.hidden = true; exportMenuBtn.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Dark mode toggle (REQ-054)
  const darkBtn = document.getElementById('dark-mode-toggle');
  if (darkBtn) {
    const stored = localStorage.getItem('card-maker-theme');
    if (stored === 'dark') document.documentElement.classList.add('dark');
    darkBtn.addEventListener('click', () => {
      const isDark = document.documentElement.classList.toggle('dark');
      localStorage.setItem('card-maker-theme', isDark ? 'dark' : 'light');
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

function updateCardSearchVisibility() {
  const bar = document.querySelector('.card-search-bar');
  if (bar) bar.hidden = activeView !== 'cards';
}

function showShortcutsModal() {
  const existing = document.getElementById('shortcuts-modal');
  if (existing) { existing.remove(); return; }

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
  modal.querySelector('#shortcuts-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function h(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', h); }
  });
  modal.querySelector('#shortcuts-close').focus();
}

// ── REQ-064: Deck import / export ─────────────────────────────────────────────

/**
 * Export the current card type + data as a single .cardmaker JSON file.
 */
export function exportDeck() {
  const ct = getActiveCardType();
  const data = getData();
  if (!ct) { showToast('No card type selected.', 'error'); return; }

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
    const schemaObj = { id: ct.id, name: ct.name, description: ct.description, cardSize: ct.cardSize, fields: ct.fields, colorMapping: ct.colorMapping };
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
  if (!ct || !data) { showToast('No cards to export.', 'error'); return; }

  // Dynamically import heavy libraries (code-split, not in critical path)
  let htmlToImage, JSZip;
  try {
    [{ default: htmlToImage }, { default: JSZip }] = await Promise.all([
      import('html-to-image'),
      import('jszip'),
    ]);
  } catch {
    showToast('PNG export requires html-to-image and jszip packages. Run: npm install html-to-image jszip', 'error', 8000);
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
      await new Promise(r => requestAnimationFrame(r));

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

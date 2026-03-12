/**
 * UI module — DOM manipulation, event binding, rendering.
 */
import * as registry from './card-type-registry.js';
import { renderCard } from './template-renderer.js';
import { parseCsv, generateCsv, remapHeaders } from './csv-parser.js';
import { renderTable, destroyTable, getFilteredIndices } from './table-view.js';
import { initEditView, openEditModal } from './edit-view.js';
import { buildPrintLayout, clearPrintLayout } from './print-layout.js';
import { getStarterSchema, getStarterFront, getStarterBack, getStarterCss } from './starter-files.js';
import { preloadIcons } from './icon-loader.js';
import { setData, registerRerenderFn, registerGetActiveCardTypeFn } from './state.js';
import { showToast } from './toast.js';

// DOM refs
const cardTypeSelect = document.getElementById('card-type-select');
const cardTypeDesc = document.getElementById('card-type-desc');
const csvUpload = document.getElementById('csv-upload');
const openCsvBtn = document.getElementById('open-csv-btn');
const csvFilename = document.getElementById('csv-filename');
const saveBtn = document.getElementById('save-btn');
const downloadSample = document.getElementById('download-sample');
const downloadTemplate = document.getElementById('download-template');
const fieldReference = document.getElementById('field-reference');
const cardGrid = document.getElementById('card-grid');
const printBtn = document.getElementById('print-btn');
const showBacksToggle = document.getElementById('show-backs');
const toastEl = document.getElementById('toast');

// Custom upload
const customSchema = document.getElementById('custom-schema');
const customFront = document.getElementById('custom-front');
const customBack = document.getElementById('custom-back');
const customCss = document.getElementById('custom-css');
const customUploadBtn = document.getElementById('custom-upload-btn');

let currentData = null;        // parsed CSV rows (mirrored in state.js)
let fileHandle = null;         // File System Access API handle (Chromium only)
let activeView = 'cards';      // 'cards' | 'table'
const hasFSAPI = 'showOpenFilePicker' in window;

// Sidebar toggle for mobile
const sidebarEl = document.getElementById('sidebar');
const sidebarToggleBtn = document.getElementById('sidebar-toggle');
const sidebarBackdrop = document.getElementById('sidebar-backdrop');

function openSidebar() {
  sidebarEl.classList.add('open');
  sidebarBackdrop.classList.add('visible');
}
function closeSidebar() {
  sidebarEl.classList.remove('open');
  sidebarBackdrop.classList.remove('visible');
}

// Re-export state accessors so existing callers continue to work.
// Canonical implementations now live in state.js.
export { getData, setRowData, deleteRows } from './state.js';
export function getActiveCardType() { return registry.get(cardTypeSelect.value); }

/**
 * Populate the card type dropdown with all registered types.
 */
export function refreshCardTypeList() {
  const types = registry.listAll();
  // Keep the placeholder option
  while (cardTypeSelect.options.length > 1) cardTypeSelect.remove(1);
  for (const t of types) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    cardTypeSelect.appendChild(opt);
  }
}

/**
 * Select a card type and update the sidebar.
 */
function selectCardType(id) {
  const ct = registry.get(id);
  if (!ct) {
    cardTypeDesc.textContent = '';
    fieldReference.innerHTML = '';
    downloadSample.style.display = 'none';
    downloadTemplate.style.display = 'none';
    renderEmpty();
    return;
  }

  cardTypeDesc.textContent = ct.description;
  renderFieldReference(ct.fields);

  // Sample CSV download
  if (ct.sampleData && ct.sampleData.length > 0) {
    downloadSample.style.display = 'inline-block';
    downloadSample.onclick = (e) => {
      e.preventDefault();
      downloadFile(`${ct.id}-sample.csv`, generateCsv(ct.fields, ct.sampleData));
    };
  } else {
    downloadSample.style.display = 'none';
  }

  // Template CSV download (headers only)
  downloadTemplate.style.display = 'inline-block';
  downloadTemplate.onclick = (e) => {
    e.preventDefault();
    downloadFile(`${ct.id}-template.csv`, generateCsv(ct.fields));
  };

  // If there's sample data and no user data loaded, show samples
  if (!currentData && ct.sampleData) {
    rerenderActiveView(ct, ct.sampleData);
  } else if (currentData) {
    rerenderActiveView(ct, currentData);
  } else {
    renderEmpty();
  }
}

/**
 * Render the field reference panel.
 */
function renderFieldReference(fields) {
  fieldReference.innerHTML = fields.map(f => {
    let info = `<span class="field-ref-key">${f.key}</span>`;
    info += `<span class="field-ref-type">${f.type}${f.required ? ' *' : ''}</span>`;
    if (f.options && f.options.length > 0) {
      info += `<div class="field-ref-opts">${f.options.join(', ')}</div>`;
    }
    if (f.separator) {
      info += `<div class="field-ref-opts">Separator: "${f.separator}"</div>`;
    }
    if (f.maxLength) {
      info += `<div class="field-ref-opts">Max: ${f.maxLength} chars</div>`;
    }
    return `<div class="field-ref-item">${info}</div>`;
  }).join('');
}

/**
 * Re-render the currently active view (cards or table).
 */
export async function rerenderActiveView(cardType, rows) {
  if (!cardType) cardType = getActiveCardType();
  if (!rows) rows = currentData || cardType?.sampleData;
  if (!cardType || !rows) return;

  if (activeView === 'table') {
    renderTable(cardType, rows);
  } else {
    // Propagate table filters/sort to cards view
    const filtered = getFilteredIndices();
    await renderCards(cardType, rows, filtered);
  }
}

/**
 * Collect all icon field values from rows for preloading.
 */
function collectIconValues(fields, rows) {
  const iconFields = fields.filter(f => f.type === 'icon');
  if (iconFields.length === 0) return [];
  const values = [];
  for (const row of rows) {
    for (const f of iconFields) {
      const v = row[f.key];
      if (v && typeof v === 'string' && v.trim()) values.push(v.trim());
    }
  }
  return values;
}

/**
 * Render cards into the grid.
 * Preloads icons (if any icon fields exist) before rendering.
 * REQ-051: shows a loading indicator during icon preload.
 * REQ-060: appends an "add new card" button at the end.
 */
export async function renderCards(cardType, rows, filteredIndices) {
  const indices = filteredIndices || rows.map((_, i) => i);

  cardGrid.innerHTML = '';
  cardGrid.classList.remove('empty-state');
  cardGrid.setAttribute('role', 'list');
  cardGrid.setAttribute('aria-label', 'Card deck');

  // REQ-051: show loading indicator while icons preload
  const visibleRows = indices.map(i => rows[i]);
  const iconValues = collectIconValues(cardType.fields, visibleRows);
  if (iconValues.length > 0) {
    const loader = document.createElement('div');
    loader.className = 'loading-indicator';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.textContent = `Loading icons…`;
    cardGrid.appendChild(loader);
    await preloadIcons(iconValues);
    loader.remove();
  }

  const showBacks = showBacksToggle.checked && !!cardType.backTemplate;
  const width = cardType.cardSize?.width || '63.5mm';
  const height = cardType.cardSize?.height || '88.9mm';

  // Apply card-view search filter (REQ-065)
  const searchInput = document.getElementById('card-search-input');
  const searchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  const displayIndices = searchQuery
    ? indices.filter(i => {
        const row = rows[i];
        return cardType.fields.some(f => String(row[f.key] || '').toLowerCase().includes(searchQuery));
      })
    : indices;

  for (const idx of displayIndices) {
    const row = rows[idx];

    const pair = document.createElement('div');
    pair.className = 'card-pair';
    pair.setAttribute('role', 'listitem');

    // Front
    const frontWrapper = document.createElement('div');
    frontWrapper.className = 'card-wrapper';
    frontWrapper.style.width = width;
    frontWrapper.style.height = height;
    frontWrapper.dataset.cardType = cardType.id;
    frontWrapper.innerHTML = renderCard(cardType.frontTemplate, row, cardType.fields, cardType);
    pair.appendChild(frontWrapper);

    // Back
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
    editBtn.title = 'Edit this card (click or press Enter)';
    editBtn.setAttribute('aria-label', `Edit card ${idx + 1}`);
    editBtn.addEventListener('click', (e) => openEditModal(idx, e.currentTarget));
    pair.appendChild(editBtn);

    cardGrid.appendChild(pair);
  }

  // REQ-060: "Add new card" button at end of grid (only when editing real data, not sample)
  if (currentData) {
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
      // Push a blank row and open edit modal for it
      const emptyRow = {};
      for (const f of cardType.fields) emptyRow[f.key] = '';
      currentData.push(emptyRow);
      setData(currentData);
      openEditModal(currentData.length - 1, addBtn);
    });

    addPair.appendChild(addBtn);
    cardGrid.appendChild(addPair);
  }

  if (displayIndices.length === 0 && !currentData) {
    renderEmpty();
  }
}

/**
 * Render the improved empty state (REQ-052).
 */
function renderEmpty() {
  const ct = getActiveCardType();
  const hasSampleData = ct && ct.sampleData && ct.sampleData.length > 0;

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
      ${hasSampleData ? `
        <button class="btn btn-primary empty-state-try-btn" id="empty-try-btn">
          ▶ Try with sample data
        </button>
      ` : ''}
      <p class="empty-state-hint">
        Drag a CSV file anywhere on this area to load it.
        <a href="docs/card-type-authoring.md" target="_blank" class="help-link">
          How to create custom card types →
        </a>
      </p>
    </div>`;

  // Wire up the "Try with sample data" button
  const tryBtn = cardGrid.querySelector('#empty-try-btn');
  if (tryBtn && ct) {
    tryBtn.addEventListener('click', () => {
      rerenderActiveView(ct, ct.sampleData);
    });
  }
}

// Re-export showToast so existing callers that import from ui.js continue to work.
export { showToast } from './toast.js';

/**
 * Trigger a file download.
 */
function downloadFile(filename, content, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ===== File System Access API helpers =====

/**
 * Open a CSV file via the File System Access API picker.
 * Falls back to clicking the hidden <input type="file">.
 */
async function openCsvWithPicker() {
  if (!hasFSAPI) {
    csvUpload.click();
    return;
  }

  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{
        description: 'CSV files',
        accept: { 'text/csv': ['.csv'], 'text/plain': ['.tsv', '.txt'] },
      }],
      multiple: false,
    });
    fileHandle = handle;
    const file = await handle.getFile();
    await loadCsvFile(file, handle.name);
  } catch (err) {
    if (err.name !== 'AbortError') {
      showToast('Failed to open file: ' + err.message, 'error');
    }
  }
}

/**
 * Load and parse a CSV file, update state and UI.
 */
async function loadCsvFile(file, displayName) {
  const ct = registry.get(cardTypeSelect.value);
  if (!ct) {
    showToast('Please select a card type first.', 'error');
    return;
  }

  let { data, errors } = await parseCsv(file);
  if (errors.length > 0) {
    showToast(`CSV warnings: ${errors[0]}`, 'error');
  }
  if (data.length === 0) {
    showToast('CSV is empty or could not be parsed.', 'error');
    return;
  }

  // Remap CSV headers (labels or old keys) to current field keys
  data = remapHeaders(data, ct.fields);

  // REQ-056: warn when no loaded columns match schema fields
  const schemaKeys = new Set(ct.fields.map(f => f.key));
  const matchedFields = Object.keys(data[0] || {}).filter(k => schemaKeys.has(k));
  if (matchedFields.length === 0 && ct.fields.length > 0) {
    const loaded = Object.keys(data[0] || {}).slice(0, 5).join(', ');
    const expected = ct.fields.slice(0, 5).map(f => f.key).join(', ');
    showToast(
      `No CSV columns match "${ct.name}" fields. ` +
      `Found: ${loaded || '(none)'}. Expected: ${expected}…`,
      'error',
      8000,
    );
  } else if (matchedFields.length < ct.fields.length) {
    const unmatched = ct.fields.map(f => f.key).filter(k => !matchedFields.includes(k));
    if (unmatched.length > 0) {
      console.warn(`[card-maker] Unmatched schema fields: ${unmatched.join(', ')}`);
    }
  }

  currentData = data;
  setData(data); // sync to state.js
  rerenderActiveView(ct, data);
  updateSaveState();
  showFilename(displayName || file.name);
  showToast(`Loaded ${data.length} card(s).`, 'success');
}

/**
 * Save the current data back to the open file handle.
 */
async function saveToFile() {
  const ct = registry.get(cardTypeSelect.value);
  if (!ct || !currentData) {
    showToast('Nothing to save.', 'error');
    return;
  }

  const csvString = generateCsv(ct.fields, currentData);

  // If we have a file handle from the File System Access API, write directly
  if (fileHandle) {
    try {
      const writable = await fileHandle.createWritable();
      await writable.write(csvString);
      await writable.close();
      showToast(`Saved to ${fileHandle.name}`, 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      showToast('Save failed: ' + err.message, 'error');
      return;
    }
  }

  // Fallback: trigger a download
  downloadFile(`${ct.id}-data.csv`, csvString);
  showToast('Downloaded CSV (use "Open CSV" for direct save).', 'success');
}

/**
 * Update the Save button's enabled/disabled state.
 */
function updateSaveState() {
  saveBtn.disabled = !currentData;
  saveBtn.title = fileHandle
    ? `Save to ${fileHandle.name} (Ctrl+S)`
    : currentData
      ? 'Download CSV (Ctrl+S)'
      : 'No data loaded';
}

/**
 * Show the currently open filename in the sidebar.
 */
function showFilename(name) {
  if (name) {
    csvFilename.textContent = name;
    csvFilename.style.display = 'block';
  } else {
    csvFilename.style.display = 'none';
  }
}

/**
 * Clear file handle and filename when switching card types.
 */
function clearFileState() {
  fileHandle = null;
  currentData = null;
  setData(null); // sync to state.js
  csvUpload.value = '';
  updateSaveState();
  showFilename(null);
}

/**
 * Bind all event listeners.
 * Also registers shared-state callbacks so table-view and edit-view
 * can access the active card type and trigger re-renders via state.js
 * without importing from ui.js directly.
 */
export function bindEvents() {
  // Register state.js callbacks (breaks bidirectional dep with table-view/edit-view)
  registerRerenderFn((ct, rows) => rerenderActiveView(ct, rows));
  registerGetActiveCardTypeFn(() => registry.get(cardTypeSelect.value));
  // Sidebar toggle (mobile)
  sidebarToggleBtn.addEventListener('click', () => {
    sidebarEl.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  sidebarBackdrop.addEventListener('click', closeSidebar);

  // Card type selection
  cardTypeSelect.addEventListener('change', () => {
    clearFileState();
    selectCardType(cardTypeSelect.value);
  });

  // "Open CSV..." button — uses File System Access API when available
  openCsvBtn.addEventListener('click', () => openCsvWithPicker());

  // Fallback file input (used when FSAPI is unavailable, or as hidden trigger)
  csvUpload.addEventListener('change', async () => {
    const file = csvUpload.files[0];
    if (!file) return;
    fileHandle = null; // classic input doesn't give us a handle
    await loadCsvFile(file, file.name);
  });

  // Save button
  saveBtn.addEventListener('click', () => saveToFile());

  // ── Keyboard shortcuts (REQ-053) ────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    const tag = document.activeElement?.tagName;
    const inInput = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

    // Ctrl+S / Cmd+S — save
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentData) saveToFile();
      return;
    }

    // Ctrl+P / Cmd+P — print
    if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
      e.preventDefault();
      printBtn.click();
      return;
    }

    // Ctrl+F / Cmd+F — focus global search (table filter or card search)
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      if (activeView === 'table') {
        const globalFilter = document.querySelector('.table-global-filter');
        if (globalFilter) { globalFilter.focus(); globalFilter.select(); }
      } else {
        const cardSearch = document.getElementById('card-search-input');
        if (cardSearch) { cardSearch.focus(); cardSearch.select(); }
      }
      return;
    }

    // ? — show keyboard shortcuts reference
    if (e.key === '?' && !inInput) {
      e.preventDefault();
      showShortcutsModal();
      return;
    }
  });

  // Show/hide backs
  showBacksToggle.addEventListener('change', () => {
    const ct = registry.get(cardTypeSelect.value);
    if (!ct) return;
    const data = currentData || ct.sampleData;
    if (data) rerenderActiveView(ct, data);
  });

  // View toggle (cards / table)
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
      const data = currentData || ct?.sampleData;
      if (ct && data) rerenderActiveView(ct, data);
    });
  });

  // Print
  printBtn.addEventListener('click', () => {
    const ct = getActiveCardType();
    const data = currentData || ct?.sampleData;
    if (!ct || !data) { showToast('No cards to print.', 'error'); return; }
    // Propagate table filters/sort to print view
    const filtered = getFilteredIndices();
    const printRows = filtered ? filtered.map(i => data[i]) : data;
    buildPrintLayout(ct, printRows);
    window.print();
  });
  window.addEventListener('afterprint', clearPrintLayout);

  // Edit view init
  initEditView();

  // Starter file downloads
  document.querySelector('.custom-upload-group').addEventListener('click', (e) => {
    if (!e.target.matches('.starter-link')) return;
    e.preventDefault();
    const type = e.target.dataset.starter;
    const starters = {
      schema: { fn: getStarterSchema, name: 'card-type.json', mime: 'application/json' },
      front:  { fn: getStarterFront,  name: 'front.html',     mime: 'text/html' },
      back:   { fn: getStarterBack,   name: 'back.html',      mime: 'text/html' },
      css:    { fn: getStarterCss,    name: 'style.css',       mime: 'text/css' },
    };
    const s = starters[type];
    if (s) downloadFile(s.name, s.fn(), s.mime);
  });

  // ── Card search bar (REQ-065) ────────────────────────────────────────────────
  const mainArea = document.getElementById('main-content');
  const cardSearchBar = document.createElement('div');
  cardSearchBar.className = 'card-search-bar';
  cardSearchBar.hidden = true; // shown only in card view when data is loaded
  cardSearchBar.innerHTML = `
    <input id="card-search-input" type="search" class="card-search-input"
           placeholder="Search cards…" aria-label="Search cards">
  `;
  mainArea.insertBefore(cardSearchBar, cardGrid);

  let cardSearchDebounce = null;
  cardSearchBar.querySelector('#card-search-input').addEventListener('input', () => {
    clearTimeout(cardSearchDebounce);
    cardSearchDebounce = setTimeout(() => {
      const ct = getActiveCardType();
      const data = currentData || ct?.sampleData;
      if (ct && data) renderCards(ct, data, getFilteredIndices() || undefined);
    }, 150);
  });

  // ── Drag-and-drop CSV (REQ-050) ──────────────────────────────────────────────
  const mainAreaEl = document.getElementById('main-content');

  mainAreaEl.addEventListener('dragover', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      mainAreaEl.classList.add('drag-over');
    }
  });
  mainAreaEl.addEventListener('dragenter', (e) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      mainAreaEl.classList.add('drag-over');
    }
  });
  mainAreaEl.addEventListener('dragleave', (e) => {
    // Only clear when leaving the main area entirely (not a child element)
    if (!mainAreaEl.contains(e.relatedTarget)) {
      mainAreaEl.classList.remove('drag-over');
    }
  });
  mainAreaEl.addEventListener('drop', async (e) => {
    e.preventDefault();
    mainAreaEl.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['csv', 'tsv', 'txt'].includes(ext)) {
      showToast('Please drop a CSV, TSV, or TXT file.', 'error');
      return;
    }
    await loadCsvFile(file, file.name);
  });

  // ── Hide raw file input when FSAPI is available ───────────────────────────
  // Hide raw file input when FSAPI is available (Open button is the primary UI)
  if (hasFSAPI) {
    csvUpload.style.display = 'none';
  } else {
    openCsvBtn.style.display = 'none';
  }

  // Custom card type upload
  customUploadBtn.addEventListener('click', async () => {
    if (!customSchema.files[0]) {
      showToast('Please provide a schema JSON file.', 'error');
      return;
    }
    if (!customFront.files[0]) {
      showToast('Please provide a front template HTML file.', 'error');
      return;
    }

    try {
      const ct = await registry.registerFromUpload(
        customSchema.files[0],
        customFront.files[0],
        customBack.files[0] || null,
        customCss.files[0] || null
      );
      refreshCardTypeList();
      cardTypeSelect.value = ct.id;
      selectCardType(ct.id);
      showToast(`Registered card type: ${ct.name}`, 'success');

      // Clear inputs
      customSchema.value = '';
      customFront.value = '';
      customBack.value = '';
      customCss.value = '';
    } catch (err) {
      showToast(err.message, 'error', 6000);
    }
  });
}

/**
 * Auto-select a card type (e.g., on initial load).
 */
export function autoSelect(id) {
  cardTypeSelect.value = id;
  selectCardType(id);
}

/**
 * Show/hide the card search bar based on current view and state.
 */
function updateCardSearchVisibility() {
  const bar = document.querySelector('.card-search-bar');
  if (bar) bar.hidden = activeView !== 'cards';
}

/**
 * Show a keyboard shortcuts reference modal (REQ-053).
 */
function showShortcutsModal() {
  const existing = document.getElementById('shortcuts-modal');
  if (existing) { existing.remove(); return; } // toggle

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
      <table class="shortcuts-table">
        <tbody>
          <tr><td><kbd>Ctrl+S</kbd></td><td>Save / download CSV</td></tr>
          <tr><td><kbd>Ctrl+P</kbd></td><td>Print / PDF</td></tr>
          <tr><td><kbd>Ctrl+F</kbd></td><td>Focus search / filter</td></tr>
          <tr><td><kbd>Escape</kbd></td><td>Close editor / cancel edit</td></tr>
          <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Previous / next card (in editor)</td></tr>
          <tr><td><kbd>Enter</kbd></td><td>Edit focused table cell</td></tr>
          <tr><td><kbd>↑</kbd> <kbd>↓</kbd> <kbd>←</kbd> <kbd>→</kbd></td><td>Navigate table cells</td></tr>
          <tr><td><kbd>?</kbd></td><td>Show / hide this panel</td></tr>
        </tbody>
      </table>
    </div>
  `;

  document.body.appendChild(modal);
  modal.querySelector('#shortcuts-close').addEventListener('click', () => modal.remove());
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { modal.remove(); document.removeEventListener('keydown', handler); }
  });
  modal.querySelector('#shortcuts-close').focus();
}

/**
 * UI module — DOM manipulation, event binding, rendering.
 */
import * as registry from './card-type-registry.js';
import { renderCard } from './template-renderer.js';
import { parseCsv, generateCsv } from './csv-parser.js';
import { renderTable, destroyTable } from './table-view.js';
import { initEditView, openEditModal } from './edit-view.js';
import { buildPrintLayout, clearPrintLayout } from './print-layout.js';
import { getStarterSchema, getStarterFront, getStarterBack, getStarterCss } from './starter-files.js';

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

let currentData = null;        // parsed CSV rows
let fileHandle = null;         // File System Access API handle (Chromium only)
let activeView = 'cards';      // 'cards' | 'table'
const hasFSAPI = 'showOpenFilePicker' in window;

// State accessors for external modules
export function getData() { return currentData; }
export function setRowData(index, row) { currentData[index] = row; }
export function getActiveCardType() { return registry.get(cardTypeSelect.value); }
export function deleteRows(indices) {
  if (!currentData) return;
  const sorted = [...indices].sort((a, b) => b - a);
  for (const i of sorted) currentData.splice(i, 1);
}

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
export function rerenderActiveView(cardType, rows) {
  if (!cardType) cardType = getActiveCardType();
  if (!rows) rows = currentData || cardType?.sampleData;
  if (!cardType || !rows) return;

  if (activeView === 'table') {
    renderTable(cardType, rows);
  } else {
    renderCards(cardType, rows);
  }
}

/**
 * Render cards into the grid.
 */
export function renderCards(cardType, rows) {
  const showBacks = showBacksToggle.checked && !!cardType.backTemplate;
  const width = cardType.cardSize?.width || '63.5mm';
  const height = cardType.cardSize?.height || '88.9mm';

  cardGrid.innerHTML = '';
  cardGrid.classList.remove('empty-state');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const pair = document.createElement('div');
    pair.className = 'card-pair';

    // Front
    const frontWrapper = document.createElement('div');
    frontWrapper.className = 'card-wrapper';
    frontWrapper.style.width = width;
    frontWrapper.style.height = height;
    frontWrapper.dataset.cardType = cardType.id;
    frontWrapper.innerHTML = renderCard(cardType.frontTemplate, row, cardType.fields);
    pair.appendChild(frontWrapper);

    // Back
    if (showBacks && cardType.backTemplate) {
      const backWrapper = document.createElement('div');
      backWrapper.className = 'card-wrapper card-back-wrapper';
      backWrapper.style.width = width;
      backWrapper.style.height = height;
      backWrapper.dataset.cardType = cardType.id;
      backWrapper.innerHTML = renderCard(cardType.backTemplate, row, cardType.fields);
      pair.appendChild(backWrapper);
    }

    // Edit button overlay
    const editBtn = document.createElement('button');
    editBtn.className = 'card-edit-btn';
    editBtn.textContent = '\u270E';
    editBtn.title = 'Edit this card';
    editBtn.addEventListener('click', () => openEditModal(i));
    pair.appendChild(editBtn);

    cardGrid.appendChild(pair);
  }

  if (rows.length === 0) {
    renderEmpty();
  }
}

function renderEmpty() {
  cardGrid.innerHTML = `<div class="empty-state">
    <p>Select a card type and upload a CSV to get started.</p>
    <p>Or pick a built-in card type to see sample cards.</p>
  </div>`;
}

/**
 * Show a toast notification.
 */
export function showToast(msg, type = 'info', duration = 4000) {
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (type !== 'info' ? ` toast-${type}` : '');
  toastEl.hidden = false;
  clearTimeout(toastEl._timeout);
  toastEl._timeout = setTimeout(() => { toastEl.hidden = true; }, duration);
}

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

  const { data, errors } = await parseCsv(file);
  if (errors.length > 0) {
    showToast(`CSV warnings: ${errors[0]}`, 'error');
  }
  if (data.length === 0) {
    showToast('CSV is empty or could not be parsed.', 'error');
    return;
  }

  currentData = data;
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
  csvUpload.value = '';
  updateSaveState();
  showFilename(null);
}

/**
 * Bind all event listeners.
 */
export function bindEvents() {
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

  // Ctrl+S / Cmd+S keyboard shortcut
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      if (currentData) saveToFile();
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
    buildPrintLayout(ct, data);
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

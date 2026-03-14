/**
 * File I/O module — CSV loading, saving, File System Access API, downloads.
 *
 * Extracted from ui.js (REQ-022). Imports shared state from state.js and
 * toast from toast.js so it has no dependency on ui.js.
 */

import { parseCsv, generateCsv, remapHeaders } from './csv-parser.js';
import { setData, getData, getActiveCardType, rerenderActiveView } from './state.js';
import { showToast } from './toast.js';

/** @type {FileSystemFileHandle|null} */
let _fileHandle = null;
let _fileName = null; // display name for session restore

/** Whether the File System Access API is available (Chromium only). */
export const hasFSAPI = typeof window !== 'undefined' && 'showOpenFilePicker' in window;

/** @returns {FileSystemFileHandle|null} */
export function getFileHandle() {
  return _fileHandle;
}
export function getFileName() {
  return _fileName;
}

/** @param {FileSystemFileHandle|null} h */
export function setFileHandle(h) {
  _fileHandle = h;
}

/**
 * Trigger a browser file download.
 * @param {string} filename
 * @param {string} content
 * @param {string} [mimeType]
 */
export function downloadFile(filename, content, mimeType = 'text/csv') {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Open a CSV via the File System Access API picker, falling back to a
 * hidden <input type="file"> on non-Chromium browsers.
 * @param {HTMLInputElement} csvUploadInput - The hidden file input element
 */
export async function openCsvWithPicker(csvUploadInput) {
  if (!hasFSAPI) {
    csvUploadInput.click();
    return;
  }
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'CSV files', accept: { 'text/csv': ['.csv'], 'text/plain': ['.tsv', '.txt'] } }],
      multiple: false,
    });
    _fileHandle = handle;
    const file = await handle.getFile();
    await loadCsvFile(file, handle.name);
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Failed to open file: ' + err.message, 'error');
  }
}

/**
 * Parse and load a CSV file into the app state, then re-render.
 * @param {File} file
 * @param {string} [displayName]
 */
export async function loadCsvFile(file, displayName) {
  const ct = getActiveCardType();
  if (!ct) {
    showToast('Please select a card type first.', 'error');
    return;
  }

  // Guard against extremely large files (> 20 MB)
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    showToast(`File is too large (${Math.round(file.size / 1024 / 1024)}MB). Max: 20MB.`, 'error');
    return;
  }

  const { data: rawData, errors } = await parseCsv(file);
  if (errors.length > 0) showToast(`CSV warnings: ${errors[0]}`, 'error');
  if (rawData.length === 0) {
    showToast('CSV is empty or could not be parsed.', 'error');
    return;
  }

  const data = remapHeaders(rawData, ct.fields);

  // Warn when no CSV columns match schema fields (REQ-056)
  const schemaKeys = new Set(ct.fields.map((f) => f.key));
  const matched = Object.keys(data[0] || {}).filter((k) => schemaKeys.has(k));
  if (matched.length === 0 && ct.fields.length > 0) {
    const loaded = Object.keys(data[0] || {})
      .slice(0, 5)
      .join(', ');
    const expected = ct.fields
      .slice(0, 5)
      .map((f) => f.key)
      .join(', ');
    showToast(
      `No CSV columns match "${ct.name}" fields. Found: ${loaded || '(none)'}. Expected: ${expected}…`,
      'error',
      8000,
    );
  } else {
    const unmatched = ct.fields.map((f) => f.key).filter((k) => !matched.includes(k));
    if (unmatched.length > 0) console.warn(`[card-maker] Unmatched schema fields: ${unmatched.join(', ')}`);
  }

  _fileName = displayName || file.name;
  setData(data);
  rerenderActiveView(ct, data);
  updateSaveState();
  showFilename(_fileName);
  showToast(`Loaded ${data.length} card(s).`, 'success');
}

/**
 * Save current data back to the open file handle (FSAPI) or download.
 */
export async function saveToFile() {
  const ct = getActiveCardType();
  const data = getData();
  if (!ct || !data) {
    showToast('Nothing to save.', 'error');
    return;
  }

  const csvString = generateCsv(ct.fields, data);

  if (_fileHandle) {
    try {
      const writable = await _fileHandle.createWritable();
      await writable.write(csvString);
      await writable.close();
      showToast(`Saved to ${_fileHandle.name}`, 'success');
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;
      showToast('Save failed: ' + err.message, 'error');
      return;
    }
  }

  downloadFile(`${ct.id}-data.csv`, csvString);
  showToast('Downloaded CSV (use "Open CSV" for direct save).', 'success');
}

/**
 * Update the Save button's enabled state and tooltip.
 */
export function updateSaveState() {
  const saveBtn = document.getElementById('save-btn');
  if (!saveBtn) return;
  const data = getData();
  saveBtn.disabled = !data;
  saveBtn.title = _fileHandle
    ? `Save to ${_fileHandle.name} (Ctrl+S)`
    : data
      ? 'Download CSV (Ctrl+S)'
      : 'No data loaded';
}

/**
 * Show or hide the loaded filename in the sidebar.
 * @param {string|null} name
 */
export function showFilename(name) {
  const el = document.getElementById('csv-filename');
  if (!el) return;
  if (name) {
    el.textContent = name;
    el.style.display = 'block';
  } else {
    el.style.display = 'none';
  }
}

/**
 * Clear file handle and data state (called when switching card types).
 */
export function clearFileState() {
  _fileHandle = null;
  _fileName = null;
  setData(null);
  const csvUpload = document.getElementById('csv-upload');
  if (csvUpload) csvUpload.value = '';
  updateSaveState();
  showFilename(null);
}

/**
 * Persistent storage module — IndexedDB session persistence (REQ-062).
 *
 * Saves the current card type + data on every edit. On app load, offers
 * to restore the last session (skipped if older than 7 days or empty).
 *
 * DB: card-maker-db  Store: sessions  Key: "last"
 */

import * as registry from './card-type-registry.js';
import { setData, getData, getActiveCardType, rerenderActiveView } from './state.js';
import { showToast } from './toast.js';
import { getFileHandle, getFileName, setFileHandle, showFilename, updateSaveState, loadCsvFile } from './file-io.js';

const DB_NAME = 'card-maker-db';
const DB_VERSION = 1;
const STORE = 'sessions';
const SESSION_KEY = 'last';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/** @returns {Promise<IDBDatabase>} */
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore(STORE);
    };
    req.onsuccess = (e) => resolve(e.target.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Persist the current session (card type + data) to IndexedDB.
 * Called after every data mutation.
 */
export async function saveSession() {
  const ct = getActiveCardType();
  const data = getData();
  if (!ct || !data || data.length === 0) return;

  try {
    const db = await openDb();
    const session = {
      cardTypeId: ct.id,
      cardTypeName: ct.name,
      frontTemplate: ct.frontTemplate,
      backTemplate: ct.backTemplate,
      css: ct.css || ct.styles || '',
      fields: ct.fields,
      colorMapping: ct.colorMapping,
      aggregations: ct.aggregations,
      cardSize: ct.cardSize,
      description: ct.description,
      data,
      savedAt: Date.now(),
      fileHandle: getFileHandle() || null,
      fileName: getFileName() || null,
    };
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(session, SESSION_KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('[card-maker] Failed to save session:', err.message);
  }
}

/**
 * Load and restore the last session on app startup.
 * Returns true if a session was restored (so app.js skips autoSelect).
 * @returns {Promise<boolean>}
 */
export async function loadLastSession() {
  try {
    const db = await openDb();
    const session = await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(SESSION_KEY);
      req.onsuccess = () => res(req.result);
      req.onerror = () => rej(req.error);
    });

    if (!session) return false;
    if (Date.now() - session.savedAt > MAX_AGE_MS) return false;
    if (!session.data || session.data.length === 0) return false;

    // Re-register the card type from saved data using bundle format
    // (Skip re-registration for built-in types — they're already registered)
    const existing = registry.get(session.cardTypeId);
    if (!existing || !existing._builtIn) {
      await registry.registerFromBundle({
        id: session.cardTypeId,
        name: session.cardTypeName,
        description: session.description || '',
        cardSize: session.cardSize || { width: '63.5mm', height: '88.9mm' },
        fields: session.fields,
        colorMapping: session.colorMapping || null,
        aggregations: session.aggregations || null,
        frontTemplate: session.frontTemplate,
        backTemplate: session.backTemplate || '',
        styles: session.css || '',
      });
    }

    // Populate dropdown + fire change event so full selectCardType flow runs
    const select = document.getElementById('card-type-select');
    if (select) {
      const { refreshCardTypeList } = await import('./ui.js');
      refreshCardTypeList();
      select.value = session.cardTypeId;
    }

    // Set data BEFORE firing change so selectCardType sees real data (not sample)
    setData(session.data);

    if (select) {
      // _fromRestore flag tells the change handler to skip clearFileState(),
      // which would wipe session.data we just loaded via setData().
      const evt = new Event('change');
      evt._fromRestore = true;
      select.dispatchEvent(evt);
    } else {
      const ct = registry.get(session.cardTypeId);
      if (ct) rerenderActiveView(ct, session.data);
    }

    // Try to silently reconnect to the CSV file
    const fileReconnected = await _tryReconnectFile(session);

    // Show resume banner (always, so user knows state was restored)
    const age = Math.round((Date.now() - session.savedAt) / 60000);
    const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
    _showResumeBanner(session, fileReconnected, ageStr);

    return true;
  } catch (err) {
    console.warn('[card-maker] Could not restore session:', err.message);
    return false;
  }
}

/**
 * Clear the saved session from IndexedDB.
 */
export async function clearSession() {
  try {
    const db = await openDb();
    await new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(SESSION_KEY);
      tx.oncomplete = res;
      tx.onerror = () => rej(tx.error);
    });
  } catch (err) {
    console.warn('[card-maker] Failed to clear session:', err.message);
  }
}

/**
 * Try to silently reconnect the saved file handle.
 * Returns true if we successfully re-opened the file.
 */
async function _tryReconnectFile(session) {
  const handle = session.fileHandle;
  if (!handle || typeof handle.queryPermission !== 'function') return false;
  try {
    let perm = await handle.queryPermission({ mode: 'readwrite' });
    if (perm === 'prompt') {
      // Don't auto-prompt — let the banner button do it
      return false;
    }
    if (perm === 'granted') {
      const file = await handle.getFile();
      setFileHandle(handle);
      showFilename(file.name);
      updateSaveState();
      return true;
    }
  } catch (e) {
    console.warn('[card-maker] Could not reconnect file handle:', e.message);
  }
  return false;
}

/**
 * Show a persistent resume banner above the card grid.
 * Dismissed when user clicks elsewhere or explicitly closes it.
 */
function _showResumeBanner(session, fileReconnected, ageStr) {
  // Remove any existing banner
  document.getElementById('resume-banner')?.remove();

  const banner = document.createElement('div');
  banner.id = 'resume-banner';
  banner.className = 'resume-banner';
  banner.setAttribute('role', 'status');

  const ctName = session.cardTypeName || 'Custom';
  const cards = session.data?.length ?? 0;
  const fileName = session.fileName;

  let fileStatus = '';
  if (fileName && fileReconnected) {
    fileStatus = `<span class="resume-file resume-file-ok">📄 ${fileName} — save enabled</span>`;
  } else if (fileName && session.fileHandle) {
    fileStatus = `<button id="resume-reconnect-btn" class="btn btn-sm resume-reconnect">📂 Reconnect ${fileName}</button>`;
  }

  banner.innerHTML = `
    <span class="resume-info">
      <strong>Session restored</strong> — ${cards} ${ctName} cards from ${ageStr}
    </span>
    ${fileStatus}
    <button id="resume-dismiss" class="resume-dismiss" aria-label="Dismiss">✕</button>`;

  // Insert before the deck-bar or as first child of main-content
  const target = document.getElementById('main-content');
  if (target) target.prepend(banner);

  // Dismiss
  banner.querySelector('#resume-dismiss')?.addEventListener('click', () => banner.remove());

  // Reconnect button: request permission and re-read file
  banner.querySelector('#resume-reconnect-btn')?.addEventListener('click', async () => {
    try {
      const handle = session.fileHandle;
      const perm = await handle.requestPermission({ mode: 'readwrite' });
      if (perm === 'granted') {
        const file = await handle.getFile();
        setFileHandle(handle);
        await loadCsvFile(file, file.name);
        banner.remove();
        showToast(`Reconnected to ${file.name}`, 'success');
      }
    } catch (e) {
      showToast('Could not reconnect to file: ' + e.message, 'error');
    }
  });

  // Auto-dismiss after 8 seconds if file is already reconnected
  if (fileReconnected) {
    setTimeout(() => banner?.remove(), 8000);
  }
}

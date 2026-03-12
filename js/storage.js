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
      css: ct.css,
      fields: ct.fields,
      colorMapping: ct.colorMapping,
      cardSize: ct.cardSize,
      description: ct.description,
      data,
      savedAt: Date.now(),
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

    // Re-register the card type from the saved templates
    const schemaObj = {
      id: session.cardTypeId,
      name: session.cardTypeName,
      description: session.description || '',
      cardSize: session.cardSize || { width: '63.5mm', height: '88.9mm' },
      fields: session.fields,
      colorMapping: session.colorMapping || null,
    };
    await registry.registerFromUpload(
      new File([JSON.stringify(schemaObj)], 'card-type.json'),
      new File([session.frontTemplate], 'front.html'),
      session.backTemplate ? new File([session.backTemplate], 'back.html') : null,
      session.css ? new File([session.css], 'style.css') : null,
    );

    // Populate the dropdown and select this type
    const select = document.getElementById('card-type-select');
    if (select) {
      // Trigger refreshCardTypeList via the event system
      // Import dynamically to avoid circular deps
      const { refreshCardTypeList } = await import('./ui.js');
      refreshCardTypeList();
      select.value = session.cardTypeId;
    }

    setData(session.data);
    const ct = registry.get(session.cardTypeId);
    if (ct) rerenderActiveView(ct, session.data);

    const age = Math.round((Date.now() - session.savedAt) / 60000);
    const ageStr = age < 60 ? `${age}m ago` : `${Math.round(age / 60)}h ago`;
    showToast(`Restored last session: ${session.data.length} ${session.cardTypeName} cards (${ageStr}).`, 'success', 5000);

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

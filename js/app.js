/**
 * Card Maker — main entry point.
 */
import { registerBuiltIn } from './card-type-registry.js';
import { refreshCardTypeList, bindEvents, autoSelect, showToast } from './ui.js';
import { undo, redo, canUndo, canRedo, clearHistory } from './undo-stack.js';
import { loadLastSession } from './storage.js';

async function init() {
  try {
    await registerBuiltIn('plant-care');
    await registerBuiltIn('ttrpg');

    refreshCardTypeList();
    bindEvents();

    // Ctrl+Z / Ctrl+Shift+Z — undo/redo (REQ-055)
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
      if (inInput) return;

      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        if (canRedo()) { redo(); showToast('Redo', 'info', 1500); }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (canUndo()) { undo(); showToast('Undo', 'info', 1500); }
        return;
      }
    });

    // Clear undo history when a new file is loaded (fresh start)
    document.addEventListener('card-maker:data-loaded', () => clearHistory());

    // REQ-062: restore last session from IndexedDB
    const restored = await loadLastSession();
    if (restored) {
      // loadLastSession handles card type registration and data restoration
      return;
    }

    autoSelect('ttrpg');
  } catch (err) {
    console.error('Failed to initialize:', err);
    showToast('Failed to load card types: ' + err.message, 'error', 8000);
  }
}

document.addEventListener('DOMContentLoaded', init);

// REQ-046: register service worker for PWA offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('[card-maker] SW registration failed:', err.message);
  });
}

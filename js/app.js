/**
 * Card Maker — main entry point.
 */
import { registerBuiltIn } from './card-type-registry.js';
import { refreshCardTypeList, bindEvents, autoSelect, showToast } from './ui.js';

async function init() {
  try {
    // Register built-in card types
    await registerBuiltIn('plant-care');

    // Populate UI
    refreshCardTypeList();
    bindEvents();

    // Auto-select the first built-in type
    autoSelect('plant-care');
  } catch (err) {
    console.error('Failed to initialize:', err);
    showToast('Failed to load card types: ' + err.message, 'error', 8000);
  }
}

document.addEventListener('DOMContentLoaded', init);

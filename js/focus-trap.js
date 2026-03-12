/**
 * Focus trap utility for modal dialogs.
 *
 * Keeps keyboard focus within a container element while it is active,
 * and restores focus to the trigger element on deactivation.
 * Addresses WCAG 2.1 success criterion 2.1.2 (No Keyboard Trap).
 */

/** Selector for all naturally focusable elements. */
const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

/**
 * Create a focus trap for a container element.
 *
 * @param {HTMLElement} container - Element to trap focus within
 * @param {{ returnFocus?: HTMLElement }} [options]
 * @returns {{ activate: function, deactivate: function }}
 *
 * @example
 * const trap = createFocusTrap(modalPanel, { returnFocus: triggerBtn });
 * trap.activate();   // called when modal opens
 * trap.deactivate(); // called when modal closes → focus returns to triggerBtn
 */
export function createFocusTrap(container, options = {}) {
  let _handleKeydown = null;

  function activate() {
    const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    first.focus();

    _handleKeydown = (e) => {
      if (e.key !== 'Tab') return;

      if (focusable.length === 1) {
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        // Shift+Tab: wrap backward
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        // Tab: wrap forward
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', _handleKeydown);
  }

  function deactivate() {
    if (_handleKeydown) {
      container.removeEventListener('keydown', _handleKeydown);
      _handleKeydown = null;
    }
    if (options.returnFocus && typeof options.returnFocus.focus === 'function') {
      options.returnFocus.focus();
    }
  }

  return { activate, deactivate };
}

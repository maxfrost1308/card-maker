/**
 * Toast notification utility.
 *
 * Separated from ui.js so that table-view.js and edit-view.js can show toasts
 * without importing from ui.js (which would create a bidirectional dependency).
 */

/**
 * Show a toast notification.
 * @param {string} msg - Message to display
 * @param {'info'|'success'|'error'} [type] - Toast style
 * @param {number} [duration] - Auto-dismiss delay in milliseconds
 */
export function showToast(msg, type = 'info', duration = 4000) {
  const toastEl = document.getElementById('toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (type !== 'info' ? ` toast-${type}` : '');
  toastEl.hidden = false;
  clearTimeout(toastEl._timeout);
  toastEl._timeout = setTimeout(() => {
    toastEl.hidden = true;
  }, duration);
}

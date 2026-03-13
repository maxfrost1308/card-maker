/**
 * Undo/redo stack (REQ-055).
 *
 * A lightweight command stack that stores { undo, redo } function pairs.
 * Limit of 50 entries to cap memory usage.
 *
 * Usage:
 *   import { pushUndo, undo, redo, canUndo, canRedo } from './undo-stack.js';
 *   // Before a mutation:
 *   pushUndo({ undo: () => restoreOldData(), redo: () => applyNewData() });
 */

const MAX = 50;

/** @type {Array<{undo: function, redo: function}>} */
const _undoStack = [];

/** @type {Array<{undo: function, redo: function}>} */
const _redoStack = [];

/**
 * Push a command onto the undo stack. Clears the redo stack.
 * @param {{ undo: function, redo: function }} command
 */
export function pushUndo(command) {
  _undoStack.push(command);
  if (_undoStack.length > MAX) _undoStack.shift();
  _redoStack.length = 0; // clear redo on new action
}

/** @returns {boolean} */
export function canUndo() { return _undoStack.length > 0; }

/** @returns {boolean} */
export function canRedo() { return _redoStack.length > 0; }

/**
 * Undo the last command.
 * @returns {boolean} true if an undo was performed
 */
export function undo() {
  const cmd = _undoStack.pop();
  if (!cmd) return false;
  cmd.undo();
  _redoStack.push(cmd);
  return true;
}

/**
 * Redo the last undone command.
 * @returns {boolean} true if a redo was performed
 */
export function redo() {
  const cmd = _redoStack.pop();
  if (!cmd) return false;
  cmd.redo();
  _undoStack.push(cmd);
  return true;
}

/** Clear both stacks (e.g. when a new file is loaded). */
export function clearHistory() {
  _undoStack.length = 0;
  _redoStack.length = 0;
}

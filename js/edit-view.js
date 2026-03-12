/**
 * Edit View module — modal for editing individual card data.
 */
import { getData, setRowData, getActiveCardType, rerenderActiveView } from './state.js';
import { showToast } from './toast.js';
import { createPillPicker, createTagPicker } from './table-view.js';
import { createFocusTrap } from './focus-trap.js';

let currentEditIndex = null;
let initialized = false;
let _focusTrap = null;
let _lastTrigger = null; // element that opened the modal (for focus return)

/**
 * Initialize edit view event listeners (call once from bindEvents).
 */
export function initEditView() {
  if (initialized) return;
  initialized = true;

  const modal = document.getElementById('edit-modal');
  const saveBtn = document.getElementById('edit-save');
  const cancelBtn = document.getElementById('edit-cancel');
  const closeBtn = document.getElementById('edit-close');
  const prevBtn = document.getElementById('edit-prev');
  const nextBtn = document.getElementById('edit-next');

  saveBtn.addEventListener('click', saveCurrentEdit);
  cancelBtn.addEventListener('click', closeEditModal);
  closeBtn.addEventListener('click', closeEditModal);
  prevBtn.addEventListener('click', () => navigateEdit(-1));
  nextBtn.addEventListener('click', () => navigateEdit(1));

  // Click backdrop to close
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeEditModal();
  });

  // Escape to close
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !modal.hidden) {
      closeEditModal();
    }
  });
}

/**
 * Open the edit modal for a given row index.
 * @param {number} rowIndex
 * @param {HTMLElement} [triggerEl] - Element to return focus to when modal closes
 */
export function openEditModal(rowIndex, triggerEl) {
  _lastTrigger = triggerEl || document.activeElement || null;
  const cardType = getActiveCardType();
  const data = getData() || cardType?.sampleData;
  if (!data || !cardType || rowIndex < 0 || rowIndex >= data.length) return;

  currentEditIndex = rowIndex;
  const row = data[rowIndex];
  const fields = cardType.fields;

  const modal = document.getElementById('edit-modal');
  const body = document.getElementById('edit-modal-body');
  const title = document.getElementById('edit-title');
  const prevBtn = document.getElementById('edit-prev');
  const nextBtn = document.getElementById('edit-next');

  // Title
  const firstField = fields[0];
  const cardLabel = row[firstField?.key] || `Card #${rowIndex + 1}`;
  title.textContent = `Edit: ${cardLabel}`;

  // Navigation state
  prevBtn.disabled = rowIndex === 0;
  nextBtn.disabled = rowIndex === data.length - 1;

  // Parse verified fields
  const verifiedSet = new Set(
    (row.verified_fields || '').split('|').map(v => v.trim()).filter(Boolean)
  );

  // Build form
  body.innerHTML = '';
  for (const field of fields) {
    // Skip hidden fields (verified_fields, back_color, etc.)
    if (field.hidden) continue;

    const wrapper = document.createElement('div');
    wrapper.className = 'edit-field';
    if (verifiedSet.has(field.key)) wrapper.classList.add('verified');

    const labelRow = document.createElement('div');
    labelRow.className = 'edit-field-label-row';

    const label = document.createElement('label');
    label.textContent = (field.label || field.key) + (field.required ? ' *' : '');

    labelRow.appendChild(label);

    // Only show verify checkbox if field is marked verifiable in schema
    if (field.verifiable) {
      const verifyCheckbox = document.createElement('input');
      verifyCheckbox.type = 'checkbox';
      verifyCheckbox.className = 'edit-verify-checkbox';
      verifyCheckbox.dataset.verifyKey = field.key;
      verifyCheckbox.checked = verifiedSet.has(field.key);
      verifyCheckbox.title = 'Mark as verified';
      verifyCheckbox.addEventListener('change', () => {
        wrapper.classList.toggle('verified', verifyCheckbox.checked);
      });
      labelRow.appendChild(verifyCheckbox);
    }

    wrapper.appendChild(labelRow);

    const value = row[field.key] || '';

    if (field.type === 'select' && field.options) {
      // Use pill picker for single-select (click to choose)
      const picker = createPillPicker(
        { ...field, type: 'multi-select' },
        value ? [value] : [],
        () => {}
      );
      picker.dataset.fieldKey = field.key;
      picker.dataset.selectType = 'single';
      wrapper.appendChild(picker);

    } else if (field.type === 'multi-select' && field.options) {
      const sep = field.separator || '|';
      const selected = typeof value === 'string' ? value.split(sep).map(v => v.trim()).filter(Boolean) : [];
      const picker = createPillPicker(field, selected, () => {});
      picker.dataset.fieldKey = field.key;
      wrapper.appendChild(picker);

    } else if (field.type === 'tags') {
      const sep = field.separator || '|';
      const selected = typeof value === 'string' ? value.split(sep).map(v => v.trim()).filter(Boolean) : [];
      const picker = createTagPicker(field, selected, () => {}, data);
      picker.dataset.fieldKey = field.key;
      wrapper.appendChild(picker);

    } else {
      const input = document.createElement('input');
      input.dataset.fieldKey = field.key;
      input.type = field.type === 'number' ? 'number' : field.type === 'url' ? 'url' : 'text';
      input.value = value;
      if (field.maxLength) input.maxLength = field.maxLength;
      wrapper.appendChild(input);
    }

    body.appendChild(wrapper);
  }

  modal.hidden = false;

  // Activate focus trap (REQ-041): keeps Tab navigation inside the modal
  const panel = modal.querySelector('.edit-modal-panel');
  if (_focusTrap) _focusTrap.deactivate();
  _focusTrap = createFocusTrap(panel, { returnFocus: _lastTrigger });
  _focusTrap.activate();
}

/**
 * Save the current edit form values back to data.
 */
function saveCurrentEdit() {
  const cardType = getActiveCardType();
  if (!cardType || currentEditIndex === null) return;

  const body = document.getElementById('edit-modal-body');
  const newRow = {};

  const verifiedKeys = [];
  for (const field of cardType.fields) {
    // Hidden fields: preserve existing values
    if (field.hidden) {
      const data = getData() || cardType.sampleData;
      if (data && data[currentEditIndex]) {
        newRow[field.key] = data[currentEditIndex][field.key] || '';
      }
      continue;
    }

    if (field.type === 'select') {
      // Single-select uses pill picker; take last selected value
      const picker = body.querySelector(`.pill-picker[data-field-key="${field.key}"]`);
      if (picker) {
        const vals = picker._selectedValues || [];
        newRow[field.key] = vals.length > 0 ? vals[vals.length - 1] : '';
      }
    } else if (field.type === 'multi-select') {
      const picker = body.querySelector(`.pill-picker[data-field-key="${field.key}"]`);
      if (picker) {
        const sep = field.separator || '|';
        newRow[field.key] = (picker._selectedValues || []).join(sep);
      }
    } else if (field.type === 'tags') {
      const picker = body.querySelector(`.tag-picker[data-field-key="${field.key}"]`);
      if (picker) {
        const sep = field.separator || '|';
        newRow[field.key] = (picker._selectedValues || []).join(sep);
      }
    } else {
      const el = body.querySelector(`[data-field-key="${field.key}"]`);
      newRow[field.key] = el ? el.value : '';
    }

    if (field.verifiable) {
      const cb = body.querySelector(`.edit-verify-checkbox[data-verify-key="${field.key}"]`);
      if (cb?.checked) verifiedKeys.push(field.key);
    }
  }
  newRow.verified_fields = verifiedKeys.join('|');

  const data = getData() || cardType.sampleData;
  if (data) data[currentEditIndex] = newRow;
  setRowData(currentEditIndex, newRow);
  rerenderActiveView();
  closeEditModal();
  showToast('Card updated.', 'success');
}

/**
 * Navigate to prev/next card in the modal.
 */
function navigateEdit(direction) {
  const cardType = getActiveCardType();
  const data = getData() || cardType?.sampleData;
  if (!data) return;
  const newIndex = currentEditIndex + direction;
  if (newIndex >= 0 && newIndex < data.length) {
    openEditModal(newIndex);
  }
}

/**
 * Close the edit modal and restore focus.
 */
function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  modal.hidden = true;
  document.getElementById('edit-modal-body').innerHTML = '';
  currentEditIndex = null;
  // Deactivate focus trap and return focus to the trigger element
  if (_focusTrap) {
    _focusTrap.deactivate();
    _focusTrap = null;
  }
}

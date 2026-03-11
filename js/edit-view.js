/**
 * Edit View module — modal for editing individual card data.
 */
import { getData, setRowData, getActiveCardType, rerenderActiveView } from './ui.js';
import { showToast } from './ui.js';
import { createTagPicker } from './table-view.js';

let currentEditIndex = null;
let initialized = false;

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
 */
export function openEditModal(rowIndex) {
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

  // Build form
  body.innerHTML = '';
  for (const field of fields) {
    const wrapper = document.createElement('div');
    wrapper.className = 'edit-field';

    const label = document.createElement('label');
    label.textContent = (field.label || field.key) + (field.required ? ' *' : '');
    wrapper.appendChild(label);

    const value = row[field.key] || '';

    if (field.type === 'select' && field.options) {
      const select = document.createElement('select');
      select.dataset.fieldKey = field.key;

      const emptyOpt = document.createElement('option');
      emptyOpt.value = '';
      emptyOpt.textContent = '--';
      select.appendChild(emptyOpt);

      for (const opt of field.options) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === value) option.selected = true;
        select.appendChild(option);
      }
      wrapper.appendChild(select);

    } else if (field.type === 'multi-select' && field.options) {
      const sep = field.separator || '|';
      const selected = typeof value === 'string' ? value.split(sep).map(v => v.trim()).filter(Boolean) : [];
      const picker = createTagPicker(field, selected, () => {});
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

  // Focus first input
  const firstInput = body.querySelector('input, select');
  if (firstInput) firstInput.focus();
}

/**
 * Save the current edit form values back to data.
 */
function saveCurrentEdit() {
  const cardType = getActiveCardType();
  if (!cardType || currentEditIndex === null) return;

  const body = document.getElementById('edit-modal-body');
  const newRow = {};

  for (const field of cardType.fields) {
    if (field.type === 'multi-select') {
      const picker = body.querySelector(`.tag-picker[data-field-key="${field.key}"]`);
      if (picker) {
        const sep = field.separator || '|';
        newRow[field.key] = (picker._selectedValues || []).join(sep);
      }
    } else {
      const el = body.querySelector(`[data-field-key="${field.key}"]`);
      newRow[field.key] = el ? el.value : '';
    }
  }

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
 * Close the edit modal.
 */
function closeEditModal() {
  const modal = document.getElementById('edit-modal');
  modal.hidden = true;
  document.getElementById('edit-modal-body').innerHTML = '';
  currentEditIndex = null;
}

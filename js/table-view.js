/**
 * Table View module — sortable, filterable data table for card data.
 *
 * Pill/tag picker components live in js/table/pill-picker.js (REQ-021).
 * This module re-exports createTagPicker and createPillPicker for
 * backward compatibility (edit-view.js imports them from here).
 */
import { openEditModal } from './edit-view.js';
import { deleteRows, setRowData, rerenderActiveView, getData } from './state.js';
import { showToast } from './toast.js';
import { pushUndo } from './undo-stack.js';
import {
  hashTagColor,
  isPillField,
  createPill,
  createTagPicker,
  createPillPicker,
} from './table/pill-picker.js';

// Re-export pickers: edit-view.js imports createTagPicker/createPillPicker from this module
export { createTagPicker, createPillPicker };

let container = null;
let currentCardType = null;
let currentRows = null;
let sortState = { key: null, dir: 'asc' };
let columnFilters = {};  // string for text fields, Set for select/multi-select
let globalFilter = '';
let debounceTimer = null;
const selectedIndices = new Set();
let visibleColumns = null; // Set of field keys to show; null = use defaults
let _abortController = null; // for cleaning up document-level listeners on re-render

// Module-level DOM refs set during renderTable
let bulkBar = null;
let bulkCountEl = null;
let selectAllCb = null;
let tbodyRef = null;
let rowCountRef = null;
let fieldsRef = null;
let filterTokensRef = null;
let filterDropdownRef = null;
let aggregationBarRef = null;

// hashTagColor, isPillField, createPill, createTagPicker, createPillPicker
// are now in js/table/pill-picker.js (REQ-021). Imported above.

/**
 * Get the list of fields that should be visible in the table.
 */
function getVisibleFields() {
  const fields = fieldsRef;
  if (visibleColumns) {
    return fields.filter(f => visibleColumns.has(f.key));
  }
  // Default: show all except hidden fields
  return fields.filter(f => !f.hidden);
}

/**
 * Render the full table view into #table-view.
 */
export function renderTable(cardType, rows) {
  // Abort previous document-level listeners to prevent accumulation
  if (_abortController) _abortController.abort();
  _abortController = new AbortController();
  const signal = _abortController.signal;

  container = document.getElementById('table-view');
  currentCardType = cardType;
  currentRows = rows;
  container.innerHTML = '';

  const fields = cardType.fields;
  fieldsRef = fields;

  // Initialize visibleColumns from schema defaults if not set
  if (!visibleColumns) {
    visibleColumns = new Set(fields.filter(f => !f.hidden).map(f => f.key));
  }

  // Controls bar
  const controls = document.createElement('div');
  controls.className = 'table-controls';

  const globalInput = document.createElement('input');
  globalInput.type = 'text';
  globalInput.className = 'table-global-filter';
  globalInput.placeholder = 'Search all columns...';
  globalInput.value = globalFilter;
  globalInput.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      globalFilter = globalInput.value;
      rebuildTbody();
    }, 150);
  });
  controls.appendChild(globalInput);

  // Filter bar
  const filterBar = buildFilterBar(fields);
  controls.appendChild(filterBar);

  // Clear filters button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn table-clear-filters-btn';
  clearBtn.textContent = 'Clear filters';
  clearBtn.addEventListener('click', () => {
    globalFilter = '';
    columnFilters = {};
    globalInput.value = '';
    renderFilterTokens();
    rebuildTbody();
  });
  controls.appendChild(clearBtn);

  // Column visibility gear button
  const colBtnWrap = document.createElement('div');
  colBtnWrap.className = 'col-prefs-wrap';
  const colBtn = document.createElement('button');
  colBtn.className = 'btn table-col-prefs-btn';
  colBtn.type = 'button';
  colBtn.title = 'Configure visible columns';
  colBtn.innerHTML = '&#9881;';
  colBtnWrap.appendChild(colBtn);

  const colDropdown = document.createElement('div');
  colDropdown.className = 'col-prefs-dropdown';
  colDropdown.hidden = true;
  colBtnWrap.appendChild(colDropdown);

  colBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!colDropdown.hidden) { colDropdown.hidden = true; return; }
    renderColumnPrefs(colDropdown, fields);
    colDropdown.hidden = false;
  });
  document.addEventListener('click', (e) => {
    if (!colBtnWrap.contains(e.target)) colDropdown.hidden = true;
  }, { signal });
  controls.appendChild(colBtnWrap);

  const rowCount = document.createElement('span');
  rowCount.className = 'table-row-count';
  rowCountRef = rowCount;
  controls.appendChild(rowCount);

  // Bulk action bar
  bulkBar = document.createElement('div');
  bulkBar.className = 'bulk-action-bar';
  bulkBar.hidden = true;

  bulkCountEl = document.createElement('span');
  bulkCountEl.className = 'bulk-count';
  bulkBar.appendChild(bulkCountEl);

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'btn btn-danger';
  deleteBtn.textContent = 'Delete selected';
  deleteBtn.addEventListener('click', () => {
    if (selectedIndices.size === 0) return;
    const count = selectedIndices.size;
    deleteRows([...selectedIndices]);
    selectedIndices.clear();
    rerenderActiveView();
    showToast(`Deleted ${count} card(s).`, 'success');
  });
  bulkBar.appendChild(deleteBtn);

  controls.appendChild(bulkBar);
  container.appendChild(controls);

  // Aggregation bar
  if (cardType.aggregations && cardType.aggregations.length > 0) {
    const aggBar = document.createElement('div');
    aggBar.className = 'table-aggregation-bar';
    aggregationBarRef = aggBar;
    container.appendChild(aggBar);
  } else {
    aggregationBarRef = null;
  }

  // Table
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';
  table._headerRow = null;

  // Thead
  const thead = document.createElement('thead');
  table._thead = thead;
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement('tbody');
  tbodyRef = tbody;
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  rebuildTable();
}

/**
 * Rebuild the entire table header + body (called when columns change).
 */
function rebuildTable() {
  const table = container.querySelector('.data-table');
  const thead = table._thead;
  thead.innerHTML = '';

  const vFields = getVisibleFields();
  const headerRow = document.createElement('tr');

  // Edit column header
  const editTh = document.createElement('th');
  editTh.className = 'edit-col';
  headerRow.appendChild(editTh);

  // Select-all checkbox column
  const selectAllTh = document.createElement('th');
  selectAllTh.className = 'select-col';
  selectAllCb = document.createElement('input');
  selectAllCb.type = 'checkbox';
  selectAllCb.addEventListener('change', () => {
    const visibleCheckboxes = tbodyRef.querySelectorAll('.row-checkbox');
    visibleCheckboxes.forEach(cb => {
      cb.checked = selectAllCb.checked;
      const idx = parseInt(cb.dataset.rowIdx);
      if (selectAllCb.checked) selectedIndices.add(idx);
      else selectedIndices.delete(idx);
    });
    updateBulkBar();
  });
  selectAllTh.appendChild(selectAllCb);
  headerRow.appendChild(selectAllTh);

  for (const field of vFields) {
    const th = document.createElement('th');
    th.textContent = field.label || field.key;
    th.dataset.key = field.key;
    th.setAttribute('aria-sort', sortState.key === field.key
      ? (sortState.dir === 'asc' ? 'ascending' : 'descending')
      : 'none');
    if (sortState.key === field.key) {
      th.classList.add('sorted', sortState.dir);
    }
    th.addEventListener('click', () => {
      if (sortState.key === field.key) {
        sortState.dir = sortState.dir === 'asc' ? 'desc' : 'asc';
      } else {
        sortState.key = field.key;
        sortState.dir = 'asc';
      }
      headerRow.querySelectorAll('th[data-key]').forEach(h => {
        h.classList.remove('sorted', 'asc', 'desc');
        const isSorted = h.dataset.key === sortState.key;
        h.setAttribute('aria-sort', isSorted
          ? (sortState.dir === 'asc' ? 'ascending' : 'descending')
          : 'none');
        if (isSorted) {
          h.classList.add('sorted', sortState.dir);
        }
      });
      rebuildTbody();
    });
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);
  rebuildTbody();
}

/**
 * Render column preferences dropdown.
 */
function renderColumnPrefs(dropdown, fields) {
  dropdown.innerHTML = '';
  const title = document.createElement('div');
  title.className = 'col-prefs-title';
  title.textContent = 'Visible columns';
  dropdown.appendChild(title);

  for (const field of fields) {
    const label = document.createElement('label');
    label.className = 'col-prefs-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = visibleColumns.has(field.key);
    cb.addEventListener('change', () => {
      if (cb.checked) {
        visibleColumns.add(field.key);
      } else {
        visibleColumns.delete(field.key);
      }
      rebuildTable();
    });
    const span = document.createElement('span');
    span.textContent = field.label || field.key;
    if (field.hidden) span.style.opacity = '0.6';
    label.append(cb, ' ', span);
    dropdown.appendChild(label);
  }
}

// ===== Cloudscape-style Filter Bar =====

function buildFilterBar(fields) {
  const bar = document.createElement('div');
  bar.className = 'filter-bar';

  const tokens = document.createElement('div');
  tokens.className = 'filter-bar-tokens';
  filterTokensRef = tokens;
  bar.appendChild(tokens);

  const addBtn = document.createElement('button');
  addBtn.className = 'filter-bar-add';
  addBtn.type = 'button';
  addBtn.textContent = '+ Add filter';
  bar.appendChild(addBtn);

  const dropdown = document.createElement('div');
  dropdown.className = 'filter-bar-dropdown';
  dropdown.hidden = true;
  filterDropdownRef = dropdown;
  bar.appendChild(dropdown);

  addBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!dropdown.hidden) {
      dropdown.hidden = true;
      return;
    }
    showPropertyStep(dropdown, fields);
    dropdown.hidden = false;
  });

  document.addEventListener('click', (e) => {
    if (!bar.contains(e.target)) dropdown.hidden = true;
  }, { signal: _abortController?.signal });

  renderFilterTokens();
  return bar;
}

function showPropertyStep(dropdown, fields) {
  dropdown.innerHTML = '';
  const search = document.createElement('input');
  search.className = 'filter-dropdown-search';
  search.placeholder = 'Search properties...';
  search.type = 'text';
  dropdown.appendChild(search);

  const list = document.createElement('div');
  dropdown.appendChild(list);

  function render(filter) {
    list.innerHTML = '';
    const q = (filter || '').toLowerCase();
    for (const field of fields) {
      if (field.hidden) continue;
      const label = field.label || field.key;
      if (q && !label.toLowerCase().includes(q)) continue;
      const btn = document.createElement('button');
      btn.className = 'filter-prop-btn';
      btn.type = 'button';
      btn.textContent = label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        showValueStep(dropdown, field, fields);
      });
      list.appendChild(btn);
    }
  }

  search.addEventListener('input', () => render(search.value));
  render('');
  setTimeout(() => search.focus(), 0);
}

function showValueStep(dropdown, field, fields) {
  dropdown.innerHTML = '';

  const header = document.createElement('div');
  header.className = 'filter-dropdown-header';
  const backBtn = document.createElement('button');
  backBtn.className = 'filter-back-btn';
  backBtn.type = 'button';
  backBtn.textContent = '\u2190 Back';
  backBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    showPropertyStep(dropdown, fields);
  });
  const title = document.createElement('span');
  title.textContent = field.label || field.key;
  header.append(backBtn, title);
  dropdown.appendChild(header);

  // Collect filter options: from schema (select/multi-select) or from data (tags)
  let filterOptions = null;
  if ((field.type === 'select' || field.type === 'multi-select') && field.options) {
    filterOptions = field.options;
  } else if (field.type === 'tags' && currentRows) {
    const sep = field.separator || '|';
    const optSet = new Set();
    for (const row of currentRows) {
      const val = row[field.key];
      if (val && typeof val === 'string') {
        val.split(sep).map(v => v.trim()).filter(Boolean).forEach(v => optSet.add(v));
      }
    }
    if (optSet.size > 0) filterOptions = [...optSet].sort();
  }

  if (filterOptions) {
    const filterSet = columnFilters[field.key];
    for (const opt of filterOptions) {
      const label = document.createElement('label');
      label.className = 'filter-value-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt;
      cb.checked = filterSet instanceof Set && filterSet.has(opt);
      cb.setAttribute('aria-label', `Filter by ${field.label || field.key}: ${opt}`);
      cb.addEventListener('change', () => {
        if (!columnFilters[field.key] || !(columnFilters[field.key] instanceof Set)) {
          columnFilters[field.key] = new Set();
        }
        if (cb.checked) {
          columnFilters[field.key].add(opt);
        } else {
          columnFilters[field.key].delete(opt);
          if (columnFilters[field.key].size === 0) delete columnFilters[field.key];
        }
        renderFilterTokens();
        rebuildTbody();
      });

      const pill = document.createElement('span');
      pill.className = 'cell-pill';
      pill.textContent = opt;
      if (field.pillColors && field.pillColors[opt]) {
        pill.style.backgroundColor = field.pillColors[opt];
        pill.style.color = '#fff';
      } else if (field.type === 'tags') {
        const tagColor = hashTagColor(opt);
        pill.style.backgroundColor = tagColor;
        pill.style.color = '#fff';
      }
      label.append(cb, ' ', pill);
      dropdown.appendChild(label);
    }
  } else {
    const input = document.createElement('input');
    input.className = 'filter-text-input';
    input.type = 'text';
    input.placeholder = 'Type to filter...';
    input.value = columnFilters[field.key] || '';
    dropdown.appendChild(input);

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn filter-apply-btn';
    applyBtn.type = 'button';
    applyBtn.textContent = 'Apply';
    applyBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (input.value.trim()) {
        columnFilters[field.key] = input.value.trim();
      } else {
        delete columnFilters[field.key];
      }
      renderFilterTokens();
      rebuildTbody();
      filterDropdownRef.hidden = true;
    });
    dropdown.appendChild(applyBtn);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') applyBtn.click();
      e.stopPropagation();
    });
    setTimeout(() => input.focus(), 0);
  }
}

function renderFilterTokens() {
  if (!filterTokensRef) return;
  filterTokensRef.innerHTML = '';
  for (const field of fieldsRef) {
    const filterVal = columnFilters[field.key];
    if (!filterVal) continue;
    const label = field.label || field.key;
    if (filterVal instanceof Set) {
      for (const val of filterVal) {
        filterTokensRef.appendChild(createFilterToken(field, label, val));
      }
    } else if (typeof filterVal === 'string' && filterVal) {
      filterTokensRef.appendChild(createFilterToken(field, label, filterVal));
    }
  }
}

function createFilterToken(field, label, value) {
  const token = document.createElement('span');
  token.className = 'filter-token';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'filter-token-label';
  labelSpan.textContent = label + ':';

  const valueSpan = document.createElement('span');
  valueSpan.className = 'filter-token-value';
  valueSpan.textContent = value;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'filter-token-remove';
  removeBtn.type = 'button';
  removeBtn.textContent = '\u00D7';
  removeBtn.addEventListener('click', () => {
    const filterVal = columnFilters[field.key];
    if (filterVal instanceof Set) {
      filterVal.delete(value);
      if (filterVal.size === 0) delete columnFilters[field.key];
    } else {
      delete columnFilters[field.key];
    }
    renderFilterTokens();
    rebuildTbody();
  });

  token.append(labelSpan, valueSpan, removeBtn);
  return token;
}

// ===== Cell rendering (uses createPill/isPillField/hashTagColor from pill-picker.js) =====

function renderCellContent(td, value, field) {
  td.innerHTML = '';
  if (!value) return;

  if (isPillField(field)) {
    if (field.type === 'multi-select') {
      const sep = field.separator || '|';
      const values = String(value).split(sep).map(v => v.trim()).filter(Boolean);
      const group = document.createElement('span');
      group.className = 'cell-pill-group';
      for (const v of values) group.appendChild(createPill(v, field));
      td.appendChild(group);
    } else {
      td.appendChild(createPill(String(value), field));
    }
  } else if (field.type === 'tags') {
    const sep = field.separator || '|';
    const values = String(value).split(sep).map(v => v.trim()).filter(Boolean);
    if (values.length > 0) {
      const group = document.createElement('span');
      group.className = 'cell-pill-group';
      for (const v of values) {
        const pill = document.createElement('span');
        pill.className = 'cell-pill';
        pill.textContent = v;
        pill.style.backgroundColor = hashTagColor(v);
        pill.style.color = '#fff';
        group.appendChild(pill);
      }
      td.appendChild(group);
    }
  } else {
    td.textContent = String(value);
  }
}
// ===== Inline cell editing =====

let activeEditCell = null;

function startCellEdit(td, rowIdx, field) {
  if (activeEditCell === td) return;
  if (activeEditCell) commitCellEdit();

  activeEditCell = td;
  td.classList.add('cell-editing');
  td._editCtx = { rowIdx, field };

  const rows = currentRows;
  const currentValue = rows[rowIdx][field.key] || '';
  td.innerHTML = '';

  if (field.type === 'select' && field.options) {
    // Use pill picker for single-select too
    const picker = createPillPicker(
      { ...field, type: 'multi-select' },
      currentValue ? [currentValue] : [],
      (newValues) => {
        // Single-select: only keep the last selected
        td._tagPickerValues = newValues.length > 0 ? [newValues[newValues.length - 1]] : [];
        // Auto-commit on selection
        commitCellEdit();
      }
    );
    td._tagPickerValues = currentValue ? [currentValue] : [];
    td.appendChild(picker);

    const outsideHandler = (e) => {
      if (!td.contains(e.target)) {
        document.removeEventListener('mousedown', outsideHandler, true);
        if (activeEditCell === td) commitCellEdit();
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', outsideHandler, true);
    }, 0);

  } else if (field.type === 'multi-select' && field.options) {
    const sep = field.separator || '|';
    const selected = currentValue ? String(currentValue).split(sep).map(v => v.trim()).filter(Boolean) : [];

    const picker = createPillPicker(field, selected, (newValues) => {
      td._tagPickerValues = newValues;
    });
    td._tagPickerValues = selected;
    td.appendChild(picker);

    const outsideHandler = (e) => {
      if (!td.contains(e.target)) {
        document.removeEventListener('mousedown', outsideHandler, true);
        if (activeEditCell === td) commitCellEdit();
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', outsideHandler, true);
    }, 0);

  } else if (field.type === 'tags') {
    const sep = field.separator || '|';
    const selected = currentValue ? String(currentValue).split(sep).map(v => v.trim()).filter(Boolean) : [];
    const allRows = getData() || currentRows;

    const picker = createTagPicker(field, selected, (newValues) => {
      td._tagPickerValues = newValues;
    }, allRows);
    td._tagPickerValues = selected;
    td.appendChild(picker);

    const outsideHandler = (e) => {
      if (!td.contains(e.target)) {
        document.removeEventListener('mousedown', outsideHandler, true);
        if (activeEditCell === td) commitCellEdit();
      }
    };
    setTimeout(() => {
      document.addEventListener('mousedown', outsideHandler, true);
    }, 0);

  } else {
    const input = document.createElement('input');
    input.type = field.type === 'number' ? 'number' : 'text';
    input.className = 'cell-edit-input';
    input.value = currentValue;
    if (field.maxLength) input.maxLength = field.maxLength;

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitCellEdit();
      if (e.key === 'Escape') cancelCellEdit(td, rowIdx, field);
      e.stopPropagation();
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (activeEditCell === td) commitCellEdit();
      }, 100);
    });
    td.appendChild(input);
    input.focus();
    input.select();
  }
}

function commitCellEdit() {
  if (!activeEditCell) return;
  const td = activeEditCell;
  const { rowIdx, field } = td._editCtx;

  let newValue;
  if (field.type === 'select') {
    // Pill picker stores array; for single-select take first item
    newValue = (td._tagPickerValues || [])[0] || '';
  } else if (field.type === 'multi-select' || field.type === 'tags') {
    const sep = field.separator || '|';
    newValue = (td._tagPickerValues || []).join(sep);
  } else {
    const input = td.querySelector('input');
    newValue = input ? input.value : '';
  }

  const oldRow = { ...currentRows[rowIdx] };
  const row = { ...currentRows[rowIdx], [field.key]: newValue };
  currentRows[rowIdx] = row;
  setRowData(rowIdx, row);

  // Push undo command (REQ-055)
  pushUndo({
    undo: () => { setRowData(rowIdx, oldRow); rerenderActiveView(); },
    redo: () => { setRowData(rowIdx, row); rerenderActiveView(); },
  });

  td.classList.remove('cell-editing');
  delete td._editCtx;
  activeEditCell = null;
  renderCellContent(td, newValue, field);
}

function cancelCellEdit(td, rowIdx, field) {
  td.classList.remove('cell-editing');
  delete td._editCtx;
  activeEditCell = null;
  renderCellContent(td, currentRows[rowIdx][field.key] || '', field);
}

// ===== Shared filter/sort logic =====

/**
 * Apply column filters, global filter, and sort to produce a filtered index array.
 * Consistent ordering: column filters → global filter → sort.
 *
 * @param {Object[]} rows - All data rows
 * @param {Object[]} fields - Schema field definitions
 * @returns {number[]} Filtered and sorted row indices
 */
function _applyFiltersAndSort(rows, fields) {
  let indices = rows.map((_, i) => i);

  // Column filters
  indices = indices.filter(i => {
    for (const field of fields) {
      const filterVal = columnFilters[field.key];
      if (!filterVal) continue;

      if (filterVal instanceof Set) {
        if (filterVal.size === 0) continue;
        const cellVal = String(rows[i][field.key] || '');
        if (field.type === 'multi-select' || field.type === 'tags') {
          const sep = field.separator || '|';
          const cellOptions = cellVal.split(sep).map(v => v.trim());
          if (!cellOptions.some(v => filterVal.has(v))) return false;
        } else {
          if (!filterVal.has(cellVal)) return false;
        }
      } else {
        const cellVal = String(rows[i][field.key] || '').toLowerCase();
        if (!cellVal.includes(filterVal.toLowerCase())) return false;
      }
    }
    return true;
  });

  // Global filter
  if (globalFilter) {
    const gf = globalFilter.toLowerCase();
    indices = indices.filter(i => {
      return fields.some(field => {
        return String(rows[i][field.key] || '').toLowerCase().includes(gf);
      });
    });
  }

  // Sort
  if (sortState.key) {
    const key = sortState.key;
    const field = fields.find(f => f.key === key);
    const isNumber = field && field.type === 'number';
    indices.sort((a, b) => {
      const va = rows[a][key] || '';
      const vb = rows[b][key] || '';
      let cmp;
      if (isNumber) {
        cmp = (parseFloat(va) || 0) - (parseFloat(vb) || 0);
      } else {
        cmp = String(va).localeCompare(String(vb));
      }
      return sortState.dir === 'desc' ? -cmp : cmp;
    });
  }

  return indices;
}

// ===== Rebuild tbody =====

function rebuildTbody() {
  if (activeEditCell) commitCellEdit();

  const fields = fieldsRef;
  const vFields = getVisibleFields();
  const rows = currentRows;
  const tbody = tbodyRef;

  const indices = _applyFiltersAndSort(rows, fields);

  // Build rows
  tbody.innerHTML = '';
  let rowDisplayIdx = 0;
  for (const idx of indices) {
    const tr = document.createElement('tr');

    // Edit button cell
    const editTd = document.createElement('td');
    editTd.className = 'edit-col';
    const editBtn = document.createElement('button');
    editBtn.className = 'table-edit-btn';
    editBtn.textContent = '\u270E';
    editBtn.title = 'Edit this row';
    editBtn.type = 'button';
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openEditModal(idx);
    });
    editTd.appendChild(editBtn);
    tr.appendChild(editTd);

    // Checkbox cell
    const cbTd = document.createElement('td');
    cbTd.className = 'select-col';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'row-checkbox';
    cb.dataset.rowIdx = idx;
    cb.checked = selectedIndices.has(idx);
    cb.addEventListener('change', () => {
      if (cb.checked) selectedIndices.add(idx);
      else selectedIndices.delete(idx);
      updateBulkBar();
      updateSelectAllState(indices);
    });
    cbTd.appendChild(cb);
    tr.appendChild(cbTd);

    // Data cells — only visible fields, click or keyboard to inline edit (REQ-042)
    vFields.forEach((field, colIdx) => {
      const td = document.createElement('td');
      td.tabIndex = 0; // make focusable for keyboard nav
      td.dataset.navRow = String(rowDisplayIdx);
      td.dataset.navCol = String(colIdx);
      renderCellContent(td, rows[idx][field.key] || '', field);

      td.addEventListener('click', (e) => {
        e.stopPropagation();
        startCellEdit(td, idx, field);
      });

      td.addEventListener('keydown', (e) => {
        // Enter: start editing the focused cell
        if (e.key === 'Enter') {
          e.preventDefault();
          startCellEdit(td, idx, field);
          return;
        }
        // Escape: cancel active edit (already handled inside inputs, but catch here too)
        if (e.key === 'Escape' && activeEditCell) {
          cancelCellEdit(activeEditCell, activeEditCell._editCtx.rowIdx, activeEditCell._editCtx.field);
          td.focus();
          return;
        }
        // Arrow keys: navigate to adjacent cell
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
          e.preventDefault();
          const curRow = parseInt(td.dataset.navRow);
          const curCol = parseInt(td.dataset.navCol);
          let targetRow = curRow, targetCol = curCol;
          if (e.key === 'ArrowDown') targetRow++;
          if (e.key === 'ArrowUp') targetRow--;
          if (e.key === 'ArrowRight') targetCol++;
          if (e.key === 'ArrowLeft') targetCol--;
          const target = tbodyRef.querySelector(
            `td[data-nav-row="${targetRow}"][data-nav-col="${targetCol}"]`
          );
          if (target) target.focus();
        }
      });

      tr.appendChild(td);
    });
    tbody.appendChild(tr);
    rowDisplayIdx++;
  }

  rowCountRef.textContent = `Showing ${indices.length} of ${rows.length} rows`;
  updateBulkBar();
  updateSelectAllState(indices);
  updateAggregationBar(indices);
}

function updateBulkBar() {
  if (!bulkBar) return;
  const count = selectedIndices.size;
  bulkBar.hidden = count === 0;
  bulkCountEl.textContent = `${count} selected`;
}

function updateSelectAllState(visibleIndices) {
  if (!selectAllCb || !visibleIndices) return;
  const allChecked = visibleIndices.length > 0 && visibleIndices.every(i => selectedIndices.has(i));
  const someChecked = visibleIndices.some(i => selectedIndices.has(i));
  selectAllCb.checked = allChecked;
  selectAllCb.indeterminate = someChecked && !allChecked;
}

/**
 * Render aggregation bar with counts from schema config.
 */
function updateAggregationBar(visibleIndices) {
  if (!aggregationBarRef || !currentCardType.aggregations) return;
  aggregationBarRef.innerHTML = '';
  const rows = currentRows;

  for (const agg of currentCardType.aggregations) {
    const count = visibleIndices.filter(i => {
      const val = rows[i][agg.field];
      return val === agg.value;
    }).length;

    const item = document.createElement('span');
    item.className = 'agg-item';
    item.innerHTML = `<span class="agg-label">${agg.label}:</span> <span class="agg-value">${count}</span>`;
    aggregationBarRef.appendChild(item);
  }
}

/**
 * Return the filtered & sorted row indices using the shared filter/sort helper.
 * Returns null when no filters/sort are active (i.e. all rows, natural order).
 */
export function getFilteredIndices() {
  if (!currentRows || !fieldsRef) return null;

  const hasFilters = globalFilter ||
    Object.values(columnFilters).some(v => v instanceof Set ? v.size > 0 : !!v);
  const hasSorting = !!sortState.key;
  if (!hasFilters && !hasSorting) return null;

  return _applyFiltersAndSort(currentRows, fieldsRef);
}

export function destroyTable() {
  if (_abortController) { _abortController.abort(); _abortController = null; }
  if (container) container.innerHTML = '';
  sortState = { key: null, dir: 'asc' };
  columnFilters = {};
  globalFilter = '';
  selectedIndices.clear();
  activeEditCell = null;
  visibleColumns = null;
}

/**
 * Table View module — sortable, filterable data table for card data.
 */
import { openEditModal } from './edit-view.js';
import { deleteRows, setRowData, rerenderActiveView } from './ui.js';
import { showToast } from './ui.js';

let container = null;
let currentCardType = null;
let currentRows = null;
let sortState = { key: null, dir: 'asc' };
let columnFilters = {};  // string for text fields, Set for select/multi-select
let globalFilter = '';
let debounceTimer = null;
let selectedIndices = new Set();

// Module-level DOM refs set during renderTable
let bulkBar = null;
let bulkCountEl = null;
let selectAllCb = null;
let tbodyRef = null;
let rowCountRef = null;
let fieldsRef = null;

/**
 * Render the full table view into #table-view.
 */
export function renderTable(cardType, rows) {
  container = document.getElementById('table-view');
  currentCardType = cardType;
  currentRows = rows;
  container.innerHTML = '';

  const fields = cardType.fields;
  fieldsRef = fields;

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

  // Clear filters button
  const clearBtn = document.createElement('button');
  clearBtn.className = 'btn table-clear-filters-btn';
  clearBtn.textContent = 'Clear filters';
  clearBtn.addEventListener('click', () => {
    globalFilter = '';
    columnFilters = {};
    renderTable(currentCardType, currentRows);
  });
  controls.appendChild(clearBtn);

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

  // Table
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  // Thead — header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');

  // Edit column header (empty)
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

  for (const field of fields) {
    const th = document.createElement('th');
    th.textContent = field.label || field.key;
    th.dataset.key = field.key;
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
        if (h.dataset.key === sortState.key) {
          h.classList.add('sorted', sortState.dir);
        }
      });
      rebuildTbody();
    });
    headerRow.appendChild(th);
  }
  thead.appendChild(headerRow);

  // Thead — filter row
  const filterRow = document.createElement('tr');
  filterRow.className = 'filter-row';

  // Empty cell for edit column
  filterRow.appendChild(document.createElement('td'));

  // Empty cell for checkbox column
  filterRow.appendChild(document.createElement('td'));

  for (const field of fields) {
    const td = document.createElement('td');

    if ((field.type === 'select' || field.type === 'multi-select') && field.options) {
      td.appendChild(buildSelectFilter(field));
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Filter...';
      input.className = 'col-filter';
      input.value = columnFilters[field.key] || '';
      input.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          columnFilters[field.key] = input.value;
          rebuildTbody();
        }, 150);
      });
      td.appendChild(input);
    }

    filterRow.appendChild(td);
  }
  thead.appendChild(filterRow);

  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement('tbody');
  tbodyRef = tbody;
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  rebuildTbody();
}

// ===== Excel-style filter popover =====

function buildSelectFilter(field) {
  const wrapper = document.createElement('div');
  wrapper.className = 'col-filter-select-wrapper';

  const btn = document.createElement('button');
  btn.className = 'col-filter-btn';
  btn.type = 'button';

  const filterSet = columnFilters[field.key];
  if (filterSet instanceof Set && filterSet.size > 0) {
    btn.classList.add('filter-active');
    btn.textContent = `Filter (${filterSet.size}) \u25BE`;
  } else {
    btn.textContent = 'Filter \u25BE';
  }

  const popover = document.createElement('div');
  popover.className = 'col-filter-popover';
  popover.hidden = true;

  const actions = document.createElement('div');
  actions.className = 'filter-popover-actions';
  const selectAllLink = document.createElement('a');
  selectAllLink.href = '#';
  selectAllLink.textContent = 'All';
  const clearAllLink = document.createElement('a');
  clearAllLink.href = '#';
  clearAllLink.textContent = 'None';
  actions.append(selectAllLink, ' | ', clearAllLink);
  popover.appendChild(actions);

  const checkboxes = [];
  for (const opt of field.options) {
    const label = document.createElement('label');
    label.className = 'filter-option-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt;
    cb.checked = !filterSet || filterSet.size === 0 || filterSet.has(opt);
    cb.addEventListener('change', () => applySelectFilter(field, checkboxes, btn));
    label.append(cb, ' ' + opt);
    popover.appendChild(label);
    checkboxes.push(cb);
  }

  selectAllLink.addEventListener('click', (e) => {
    e.preventDefault();
    checkboxes.forEach(cb => { cb.checked = true; });
    applySelectFilter(field, checkboxes, btn);
  });

  clearAllLink.addEventListener('click', (e) => {
    e.preventDefault();
    checkboxes.forEach(cb => { cb.checked = false; });
    applySelectFilter(field, checkboxes, btn);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    document.querySelectorAll('.col-filter-popover').forEach(p => {
      if (p !== popover) p.hidden = true;
    });
    popover.hidden = !popover.hidden;
  });

  document.addEventListener('click', (e) => {
    if (!wrapper.contains(e.target)) popover.hidden = true;
  });

  wrapper.append(btn, popover);
  return wrapper;
}

function applySelectFilter(field, checkboxes, btn) {
  const checked = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
  if (checked.length === field.options.length || checked.length === 0) {
    delete columnFilters[field.key];
    btn.classList.remove('filter-active');
    btn.textContent = 'Filter \u25BE';
  } else {
    columnFilters[field.key] = new Set(checked);
    btn.classList.add('filter-active');
    btn.textContent = `Filter (${checked.length}) \u25BE`;
  }
  rebuildTbody();
}

// ===== Pill rendering =====

function isPillField(field) {
  return (field.type === 'select' || field.type === 'multi-select') && field.options;
}

function createPill(value, field) {
  const pill = document.createElement('span');
  pill.className = 'cell-pill';
  pill.textContent = value;

  if (field.pillColors && field.pillColors[value]) {
    pill.style.backgroundColor = field.pillColors[value];
    pill.style.color = '#fff';
  }

  return pill;
}

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
    const select = document.createElement('select');
    select.className = 'cell-edit-input';

    const emptyOpt = document.createElement('option');
    emptyOpt.value = '';
    emptyOpt.textContent = '--';
    select.appendChild(emptyOpt);

    for (const opt of field.options) {
      const option = document.createElement('option');
      option.value = opt;
      option.textContent = opt;
      if (opt === currentValue) option.selected = true;
      select.appendChild(option);
    }

    select.addEventListener('change', () => commitCellEdit());
    select.addEventListener('blur', () => {
      setTimeout(() => {
        if (activeEditCell === td) commitCellEdit();
      }, 100);
    });
    select.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') cancelCellEdit(td, rowIdx, field);
    });
    td.appendChild(select);
    select.focus();

  } else if (field.type === 'multi-select' && field.options) {
    const sep = field.separator || '|';
    const selected = currentValue ? String(currentValue).split(sep).map(v => v.trim()) : [];

    const panel = document.createElement('div');
    panel.className = 'cell-edit-multi';

    for (const opt of field.options) {
      const label = document.createElement('label');
      label.className = 'cell-edit-cb-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt;
      cb.checked = selected.includes(opt);
      label.append(cb, ' ' + opt);
      panel.appendChild(label);
    }

    const doneBtn = document.createElement('button');
    doneBtn.className = 'btn cell-edit-done';
    doneBtn.textContent = 'Done';
    doneBtn.type = 'button';
    doneBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      commitCellEdit();
    });
    panel.appendChild(doneBtn);
    td.appendChild(panel);

    // Click outside to save (Excel-like behavior)
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
    const select = td.querySelector('select');
    newValue = select ? select.value : '';
  } else if (field.type === 'multi-select') {
    const sep = field.separator || '|';
    const checked = Array.from(td.querySelectorAll('input[type="checkbox"]:checked')).map(cb => cb.value);
    newValue = checked.join(sep);
  } else {
    const input = td.querySelector('input');
    newValue = input ? input.value : '';
  }

  const row = { ...currentRows[rowIdx], [field.key]: newValue };
  currentRows[rowIdx] = row;
  setRowData(rowIdx, row);

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

// ===== Rebuild tbody =====

function rebuildTbody() {
  if (activeEditCell) commitCellEdit();

  const fields = fieldsRef;
  const rows = currentRows;
  const tbody = tbodyRef;

  let indices = rows.map((_, i) => i);

  // Column filters
  indices = indices.filter(i => {
    for (const field of fields) {
      const filterVal = columnFilters[field.key];
      if (!filterVal) continue;

      if (filterVal instanceof Set) {
        if (filterVal.size === 0) continue;
        const cellVal = String(rows[i][field.key] || '');
        if (field.type === 'multi-select') {
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

  // Build rows
  tbody.innerHTML = '';
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

    // Data cells — click to inline edit
    for (const field of fields) {
      const td = document.createElement('td');
      renderCellContent(td, rows[idx][field.key] || '', field);
      td.addEventListener('click', (e) => {
        e.stopPropagation();
        startCellEdit(td, idx, field);
      });
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  rowCountRef.textContent = `Showing ${indices.length} of ${rows.length} rows`;
  updateBulkBar();
  updateSelectAllState(indices);
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

export function destroyTable() {
  if (container) container.innerHTML = '';
  sortState = { key: null, dir: 'asc' };
  columnFilters = {};
  globalFilter = '';
  selectedIndices.clear();
  activeEditCell = null;
}

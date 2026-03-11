/**
 * Table View module — sortable, filterable data table for card data.
 */
import { openEditModal } from './edit-view.js';
import { deleteRows, rerenderActiveView } from './ui.js';
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
    deleteRows([...selectedIndices]);
    selectedIndices.clear();
    rerenderActiveView();
    showToast(`Deleted ${deleteBtn._count} card(s).`, 'success');
  });
  // Store count for toast message before delete clears it
  Object.defineProperty(deleteBtn, '_count', { get: () => selectedIndices.size });
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

  // Select-all checkbox column
  const selectAllTh = document.createElement('th');
  selectAllTh.className = 'select-col';
  selectAllCb = document.createElement('input');
  selectAllCb.type = 'checkbox';
  selectAllCb.addEventListener('change', () => {
    // Toggle all visible rows
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

  // Empty cell for checkbox column
  filterRow.appendChild(document.createElement('td'));

  for (const field of fields) {
    const td = document.createElement('td');

    if ((field.type === 'select' || field.type === 'multi-select') && field.options) {
      // Excel-style multi-select filter popover
      td.appendChild(buildSelectFilter(field));
    } else {
      // Freeform text filter
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

/**
 * Build an Excel-style filter popover for select/multi-select fields.
 */
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

  // All / None links
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

  // Option checkboxes
  const checkboxes = [];
  for (const opt of field.options) {
    const label = document.createElement('label');
    label.className = 'filter-option-label';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.value = opt;
    // If no filter active, all options shown (all checked)
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
    // Close other open popovers
    document.querySelectorAll('.col-filter-popover').forEach(p => {
      if (p !== popover) p.hidden = true;
    });
    popover.hidden = !popover.hidden;
  });

  // Close on outside click
  const closeHandler = (e) => {
    if (!wrapper.contains(e.target)) popover.hidden = true;
  };
  document.addEventListener('click', closeHandler);

  wrapper.append(btn, popover);
  return wrapper;
}

/**
 * Apply select filter from checkbox states.
 */
function applySelectFilter(field, checkboxes, btn) {
  const checked = checkboxes.filter(cb => cb.checked).map(cb => cb.value);
  if (checked.length === field.options.length || checked.length === 0) {
    // All selected or none = no filter
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

/**
 * Rebuild tbody with current sort/filter state.
 */
function rebuildTbody() {
  const fields = fieldsRef;
  const rows = currentRows;
  const tbody = tbodyRef;

  // Build array of original indices
  let indices = rows.map((_, i) => i);

  // Apply column filters
  indices = indices.filter(i => {
    for (const field of fields) {
      const filterVal = columnFilters[field.key];
      if (!filterVal) continue;

      if (filterVal instanceof Set) {
        // Excel-style set filter for select/multi-select
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
        // Text filter
        const cellVal = String(rows[i][field.key] || '').toLowerCase();
        if (!cellVal.includes(filterVal.toLowerCase())) return false;
      }
    }
    return true;
  });

  // Apply global filter
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

    // Row click opens edit (but not on checkbox clicks)
    tr.addEventListener('click', (e) => {
      if (e.target.closest('.select-col')) return;
      openEditModal(idx);
    });

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

    // Data cells
    for (const field of fields) {
      const td = document.createElement('td');
      td.textContent = rows[idx][field.key] || '';
      tr.appendChild(td);
    }

    tbody.appendChild(tr);
  }

  rowCountRef.textContent = `Showing ${indices.length} of ${rows.length} rows`;
  updateBulkBar();
  updateSelectAllState(indices);
}

/**
 * Show/hide bulk action bar based on selection.
 */
function updateBulkBar() {
  if (!bulkBar) return;
  const count = selectedIndices.size;
  bulkBar.hidden = count === 0;
  bulkCountEl.textContent = `${count} selected`;
}

/**
 * Sync select-all checkbox state with current selection.
 */
function updateSelectAllState(visibleIndices) {
  if (!selectAllCb || !visibleIndices) return;
  const allChecked = visibleIndices.length > 0 && visibleIndices.every(i => selectedIndices.has(i));
  const someChecked = visibleIndices.some(i => selectedIndices.has(i));
  selectAllCb.checked = allChecked;
  selectAllCb.indeterminate = someChecked && !allChecked;
}

/**
 * Clear table view and reset state.
 */
export function destroyTable() {
  if (container) container.innerHTML = '';
  sortState = { key: null, dir: 'asc' };
  columnFilters = {};
  globalFilter = '';
  selectedIndices.clear();
}

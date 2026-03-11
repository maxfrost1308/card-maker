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
let filterTokensRef = null;
let filterDropdownRef = null;

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
  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement('tbody');
  tbodyRef = tbody;
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  rebuildTbody();
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
  });

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

  if ((field.type === 'select' || field.type === 'multi-select') && field.options) {
    const filterSet = columnFilters[field.key];
    for (const opt of field.options) {
      const label = document.createElement('label');
      label.className = 'filter-value-label';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.value = opt;
      cb.checked = filterSet instanceof Set && filterSet.has(opt);
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

// ===== Tag Picker (shared component) =====

export function createTagPicker(field, selectedValues, onChange) {
  const wrapper = document.createElement('div');
  wrapper.className = 'tag-picker';
  wrapper._selectedValues = [...selectedValues];

  const tagsContainer = document.createElement('div');
  tagsContainer.className = 'tag-picker-tags';
  wrapper.appendChild(tagsContainer);

  const inputWrap = document.createElement('div');
  inputWrap.className = 'tag-picker-input-wrap';
  const input = document.createElement('input');
  input.className = 'tag-picker-input';
  input.placeholder = 'Add...';
  input.type = 'text';
  inputWrap.appendChild(input);

  const dropdown = document.createElement('div');
  dropdown.className = 'tag-picker-dropdown';
  dropdown.hidden = true;
  inputWrap.appendChild(dropdown);
  wrapper.appendChild(inputWrap);

  function renderTags() {
    tagsContainer.innerHTML = '';
    for (const val of wrapper._selectedValues) {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      if (field.pillColors && field.pillColors[val]) {
        pill.style.backgroundColor = field.pillColors[val];
        pill.style.color = '#fff';
      }
      const text = document.createElement('span');
      text.className = 'tag-pill-text';
      text.textContent = val;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'tag-pill-remove';
      removeBtn.type = 'button';
      removeBtn.textContent = '\u00D7';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        wrapper._selectedValues = wrapper._selectedValues.filter(v => v !== val);
        renderTags();
        renderDropdown();
        onChange(wrapper._selectedValues);
      });
      pill.append(text, removeBtn);
      tagsContainer.appendChild(pill);
    }
  }

  function renderDropdown() {
    dropdown.innerHTML = '';
    const q = input.value.toLowerCase();
    const available = field.options.filter(opt =>
      !wrapper._selectedValues.includes(opt) &&
      (!q || opt.toLowerCase().includes(q))
    );

    if (available.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tag-picker-empty';
      empty.textContent = q ? 'No matches' : 'All selected';
      dropdown.appendChild(empty);
    } else {
      for (const opt of available) {
        const btn = document.createElement('button');
        btn.className = 'tag-picker-option';
        btn.type = 'button';
        const pill = document.createElement('span');
        pill.className = 'cell-pill';
        pill.textContent = opt;
        if (field.pillColors && field.pillColors[opt]) {
          pill.style.backgroundColor = field.pillColors[opt];
          pill.style.color = '#fff';
        }
        btn.appendChild(pill);
        btn.addEventListener('mousedown', (e) => {
          e.preventDefault();
          e.stopPropagation();
          wrapper._selectedValues.push(opt);
          input.value = '';
          renderTags();
          renderDropdown();
          onChange(wrapper._selectedValues);
          input.focus();
        });
        dropdown.appendChild(btn);
      }
    }
  }

  input.addEventListener('focus', () => {
    renderDropdown();
    dropdown.hidden = false;
  });

  input.addEventListener('input', () => {
    renderDropdown();
    dropdown.hidden = false;
  });

  input.addEventListener('blur', () => {
    setTimeout(() => { dropdown.hidden = true; }, 150);
  });

  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      dropdown.hidden = true;
      input.blur();
    }
  });

  renderTags();
  return wrapper;
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
    const selected = currentValue ? String(currentValue).split(sep).map(v => v.trim()).filter(Boolean) : [];

    const picker = createTagPicker(field, selected, (newValues) => {
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
    newValue = (td._tagPickerValues || []).join(sep);
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

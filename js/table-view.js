/**
 * Table View module — sortable, filterable data table for card data.
 */
import { openEditModal } from './edit-view.js';

let container = null;
let currentCardType = null;
let currentRows = null;
let sortState = { key: null, dir: 'asc' };
let columnFilters = {};
let globalFilter = '';
let debounceTimer = null;

/**
 * Render the full table view into #table-view.
 */
export function renderTable(cardType, rows) {
  container = document.getElementById('table-view');
  currentCardType = cardType;
  currentRows = rows;
  container.innerHTML = '';

  const fields = cardType.fields;

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
      rebuildTbody(fields, rows, tbody, rowCount);
    }, 150);
  });
  controls.appendChild(globalInput);

  const rowCount = document.createElement('span');
  rowCount.className = 'table-row-count';
  controls.appendChild(rowCount);
  container.appendChild(controls);

  // Table
  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';

  const table = document.createElement('table');
  table.className = 'data-table';

  // Thead — header row
  const thead = document.createElement('thead');
  const headerRow = document.createElement('tr');
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
      // Update header classes
      headerRow.querySelectorAll('th').forEach(h => {
        h.classList.remove('sorted', 'asc', 'desc');
        if (h.dataset.key === sortState.key) {
          h.classList.add('sorted', sortState.dir);
        }
      });
      rebuildTbody(fields, rows, tbody, rowCount);
    });
    headerRow.appendChild(th);
  }
  // Actions column header
  const actionsTh = document.createElement('th');
  actionsTh.textContent = 'Actions';
  actionsTh.className = 'actions-col';
  headerRow.appendChild(actionsTh);
  thead.appendChild(headerRow);

  // Thead — filter row
  const filterRow = document.createElement('tr');
  filterRow.className = 'filter-row';
  for (const field of fields) {
    const td = document.createElement('td');
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Filter...';
    input.className = 'col-filter';
    input.value = columnFilters[field.key] || '';
    input.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        columnFilters[field.key] = input.value;
        rebuildTbody(fields, rows, tbody, rowCount);
      }, 150);
    });
    td.appendChild(input);
    filterRow.appendChild(td);
  }
  filterRow.appendChild(document.createElement('td')); // empty actions cell
  thead.appendChild(filterRow);

  table.appendChild(thead);

  // Tbody
  const tbody = document.createElement('tbody');
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  container.appendChild(tableWrap);

  rebuildTbody(fields, rows, tbody, rowCount);
}

/**
 * Rebuild tbody with current sort/filter state.
 */
function rebuildTbody(fields, rows, tbody, rowCountEl) {
  // Build array of original indices
  let indices = rows.map((_, i) => i);

  // Apply column filters
  indices = indices.filter(i => {
    for (const field of fields) {
      const filterVal = columnFilters[field.key];
      if (!filterVal) continue;
      const cellVal = String(rows[i][field.key] || '').toLowerCase();
      if (!cellVal.includes(filterVal.toLowerCase())) return false;
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
    for (const field of fields) {
      const td = document.createElement('td');
      td.textContent = rows[idx][field.key] || '';
      tr.appendChild(td);
    }
    // Actions cell
    const actionsTd = document.createElement('td');
    actionsTd.className = 'actions-col';
    const editBtn = document.createElement('button');
    editBtn.className = 'btn table-edit-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditModal(idx));
    actionsTd.appendChild(editBtn);
    tr.appendChild(actionsTd);
    tbody.appendChild(tr);
  }

  rowCountEl.textContent = `Showing ${indices.length} of ${rows.length} rows`;
}

/**
 * Clear table view and reset state.
 */
export function destroyTable() {
  if (container) container.innerHTML = '';
  sortState = { key: null, dir: 'asc' };
  columnFilters = {};
  globalFilter = '';
}

/**
 * Sidebar module — card type selection, field reference, sidebar toggle.
 *
 * Extracted from ui.js (REQ-022). Handles all sidebar-specific UI logic.
 */

import * as registry from './card-type-registry.js';
import { generateCsv } from './csv-parser.js';
import { downloadFile } from './file-io.js';
import { getData, rerenderActiveView } from './state.js';

// DOM refs (queried lazily to survive module-load-before-DOM scenarios in tests)
const el = (id) => document.getElementById(id);

// Sidebar show/hide (mobile)
export function openSidebar() {
  el('sidebar')?.classList.add('open');
  el('sidebar-backdrop')?.classList.add('visible');
}

export function closeSidebar() {
  el('sidebar')?.classList.remove('open');
  el('sidebar-backdrop')?.classList.remove('visible');
}

/**
 * Populate the card type dropdown with all registered types.
 */
export function refreshCardTypeList() {
  const select = el('card-type-select');
  if (!select) return;
  const currentVal = select.value;
  const types = registry.listAll();

  // Remove everything after the first placeholder option
  while (select.options.length > 1) select.remove(1);
  // Remove old optgroups
  select.querySelectorAll('optgroup').forEach(g => g.remove());

  const builtIns = types.filter(t => t.builtIn);
  const customs = types.filter(t => !t.builtIn);

  if (builtIns.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Built-in';
    for (const t of builtIns) {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }

  if (customs.length > 0) {
    const group = document.createElement('optgroup');
    group.label = 'Custom';
    for (const t of customs) {
      const opt = document.createElement('option');
      opt.value = t.id; opt.textContent = t.name;
      group.appendChild(opt);
    }
    select.appendChild(group);
  }

  // Restore selection if still valid
  if (currentVal && select.querySelector(`option[value="${currentVal}"]`)) {
    select.value = currentVal;
  }
}

/**
 * Select a card type, update sidebar state, and render cards.
 * @param {string} id
 * @param {function(Object, Object[]): Promise<void>} renderFn - renderCards callback from ui.js
 * @param {function(): void} renderEmptyFn - renderEmpty callback from ui.js
 */
export function selectCardType(id, renderFn, renderEmptyFn) {
  const ct = registry.get(id);
  const descEl = el('card-type-desc');
  const downloadSample = el('download-sample');
  const downloadTemplate = el('download-template');

  if (!ct) {
    if (descEl) descEl.textContent = '';
    renderFieldReference([]);
    if (downloadSample) downloadSample.style.display = 'none';
    if (downloadTemplate) downloadTemplate.style.display = 'none';
    renderEmptyFn();
    return;
  }

  if (descEl) descEl.textContent = ct.description;
  renderFieldReference(ct.fields);

  // Sample CSV download
  if (ct.sampleData && ct.sampleData.length > 0) {
    if (downloadSample) {
      downloadSample.style.display = 'inline-block';
      downloadSample.onclick = (e) => {
        e.preventDefault();
        downloadFile(`${ct.id}-sample.csv`, generateCsv(ct.fields, ct.sampleData));
      };
    }
  } else {
    if (downloadSample) downloadSample.style.display = 'none';
  }

  // Template CSV download
  if (downloadTemplate) {
    downloadTemplate.style.display = 'inline-block';
    downloadTemplate.onclick = (e) => {
      e.preventDefault();
      downloadFile(`${ct.id}-template.csv`, generateCsv(ct.fields));
    };
  }

  // Render: use live data, fall back to sample data, else empty
  const data = getData();
  if (!data && ct.sampleData) {
    rerenderActiveView(ct, ct.sampleData);
  } else if (data) {
    rerenderActiveView(ct, data);
  } else {
    renderEmptyFn();
  }
}

/**
 * Render the field reference panel in the sidebar.
 * @param {Object[]} fields
 */
export function renderFieldReference(fields) {
  const ref = el('field-reference');
  if (!ref) return;
  ref.innerHTML = fields.map(f => {
    let info = `<span class="field-ref-key">${f.key}</span>`;
    info += `<span class="field-ref-type">${f.type}${f.required ? ' *' : ''}</span>`;
    if (f.options?.length > 0) info += `<div class="field-ref-opts">${f.options.join(', ')}</div>`;
    if (f.separator) info += `<div class="field-ref-opts">Separator: "${f.separator}"</div>`;
    if (f.maxLength) info += `<div class="field-ref-opts">Max: ${f.maxLength} chars</div>`;
    return `<div class="field-ref-item">${info}</div>`;
  }).join('');
}

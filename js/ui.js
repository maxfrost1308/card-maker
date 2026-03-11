/**
 * UI module — DOM manipulation, event binding, rendering.
 */
import * as registry from './card-type-registry.js';
import { renderCard } from './template-renderer.js';
import { parseCsv, generateCsv } from './csv-parser.js';

// DOM refs
const cardTypeSelect = document.getElementById('card-type-select');
const cardTypeDesc = document.getElementById('card-type-desc');
const csvUpload = document.getElementById('csv-upload');
const downloadSample = document.getElementById('download-sample');
const downloadTemplate = document.getElementById('download-template');
const fieldReference = document.getElementById('field-reference');
const cardGrid = document.getElementById('card-grid');
const printBtn = document.getElementById('print-btn');
const showBacksToggle = document.getElementById('show-backs');
const toastEl = document.getElementById('toast');

// Custom upload
const customSchema = document.getElementById('custom-schema');
const customFront = document.getElementById('custom-front');
const customBack = document.getElementById('custom-back');
const customCss = document.getElementById('custom-css');
const customUploadBtn = document.getElementById('custom-upload-btn');

let currentData = null; // parsed CSV rows

/**
 * Populate the card type dropdown with all registered types.
 */
export function refreshCardTypeList() {
  const types = registry.listAll();
  // Keep the placeholder option
  while (cardTypeSelect.options.length > 1) cardTypeSelect.remove(1);
  for (const t of types) {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    cardTypeSelect.appendChild(opt);
  }
}

/**
 * Select a card type and update the sidebar.
 */
function selectCardType(id) {
  const ct = registry.get(id);
  if (!ct) {
    cardTypeDesc.textContent = '';
    fieldReference.innerHTML = '';
    downloadSample.style.display = 'none';
    downloadTemplate.style.display = 'none';
    renderEmpty();
    return;
  }

  cardTypeDesc.textContent = ct.description;
  renderFieldReference(ct.fields);

  // Sample CSV download
  if (ct.sampleData && ct.sampleData.length > 0) {
    downloadSample.style.display = 'inline-block';
    downloadSample.onclick = (e) => {
      e.preventDefault();
      downloadFile(`${ct.id}-sample.csv`, generateCsv(ct.fields, ct.sampleData));
    };
  } else {
    downloadSample.style.display = 'none';
  }

  // Template CSV download (headers only)
  downloadTemplate.style.display = 'inline-block';
  downloadTemplate.onclick = (e) => {
    e.preventDefault();
    downloadFile(`${ct.id}-template.csv`, generateCsv(ct.fields));
  };

  // If there's sample data and no user data loaded, show samples
  if (!currentData && ct.sampleData) {
    renderCards(ct, ct.sampleData);
  } else if (currentData) {
    renderCards(ct, currentData);
  } else {
    renderEmpty();
  }
}

/**
 * Render the field reference panel.
 */
function renderFieldReference(fields) {
  fieldReference.innerHTML = fields.map(f => {
    let info = `<span class="field-ref-key">${f.key}</span>`;
    info += `<span class="field-ref-type">${f.type}${f.required ? ' *' : ''}</span>`;
    if (f.options && f.options.length > 0) {
      info += `<div class="field-ref-opts">${f.options.join(', ')}</div>`;
    }
    if (f.separator) {
      info += `<div class="field-ref-opts">Separator: "${f.separator}"</div>`;
    }
    if (f.maxLength) {
      info += `<div class="field-ref-opts">Max: ${f.maxLength} chars</div>`;
    }
    return `<div class="field-ref-item">${info}</div>`;
  }).join('');
}

/**
 * Render cards into the grid.
 */
function renderCards(cardType, rows) {
  const showBacks = showBacksToggle.checked && !!cardType.backTemplate;
  const width = cardType.cardSize?.width || '63.5mm';
  const height = cardType.cardSize?.height || '88.9mm';

  cardGrid.innerHTML = '';
  cardGrid.classList.remove('empty-state');

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    const pair = document.createElement('div');
    pair.className = 'card-pair';

    // Front
    const frontWrapper = document.createElement('div');
    frontWrapper.className = 'card-wrapper';
    frontWrapper.style.width = width;
    frontWrapper.style.height = height;
    frontWrapper.dataset.cardType = cardType.id;
    frontWrapper.innerHTML = renderCard(cardType.frontTemplate, row, cardType.fields);
    pair.appendChild(frontWrapper);

    // Back
    if (showBacks && cardType.backTemplate) {
      const backWrapper = document.createElement('div');
      backWrapper.className = 'card-wrapper card-back-wrapper';
      backWrapper.style.width = width;
      backWrapper.style.height = height;
      backWrapper.dataset.cardType = cardType.id;
      backWrapper.innerHTML = renderCard(cardType.backTemplate, row, cardType.fields);
      pair.appendChild(backWrapper);
    }

    cardGrid.appendChild(pair);
  }

  if (rows.length === 0) {
    renderEmpty();
  }
}

function renderEmpty() {
  cardGrid.innerHTML = `<div class="empty-state">
    <p>Select a card type and upload a CSV to get started.</p>
    <p>Or pick a built-in card type to see sample cards.</p>
  </div>`;
}

/**
 * Show a toast notification.
 */
export function showToast(msg, type = 'info', duration = 4000) {
  toastEl.textContent = msg;
  toastEl.className = 'toast' + (type !== 'info' ? ` toast-${type}` : '');
  toastEl.hidden = false;
  clearTimeout(toastEl._timeout);
  toastEl._timeout = setTimeout(() => { toastEl.hidden = true; }, duration);
}

/**
 * Trigger a file download.
 */
function downloadFile(filename, content) {
  const blob = new Blob([content], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Bind all event listeners.
 */
export function bindEvents() {
  // Card type selection
  cardTypeSelect.addEventListener('change', () => {
    currentData = null;
    csvUpload.value = '';
    selectCardType(cardTypeSelect.value);
  });

  // CSV upload
  csvUpload.addEventListener('change', async () => {
    const file = csvUpload.files[0];
    if (!file) return;

    const ct = registry.get(cardTypeSelect.value);
    if (!ct) {
      showToast('Please select a card type first.', 'error');
      return;
    }

    const { data, errors } = await parseCsv(file);
    if (errors.length > 0) {
      showToast(`CSV warnings: ${errors[0]}`, 'error');
    }
    if (data.length === 0) {
      showToast('CSV is empty or could not be parsed.', 'error');
      return;
    }

    currentData = data;
    renderCards(ct, data);
    showToast(`Loaded ${data.length} card(s).`, 'success');
  });

  // Show/hide backs
  showBacksToggle.addEventListener('change', () => {
    const ct = registry.get(cardTypeSelect.value);
    if (!ct) return;
    const data = currentData || ct.sampleData;
    if (data) renderCards(ct, data);
  });

  // Print
  printBtn.addEventListener('click', () => window.print());

  // Custom card type upload
  customUploadBtn.addEventListener('click', async () => {
    if (!customSchema.files[0]) {
      showToast('Please provide a schema JSON file.', 'error');
      return;
    }
    if (!customFront.files[0]) {
      showToast('Please provide a front template HTML file.', 'error');
      return;
    }

    try {
      const ct = await registry.registerFromUpload(
        customSchema.files[0],
        customFront.files[0],
        customBack.files[0] || null,
        customCss.files[0] || null
      );
      refreshCardTypeList();
      cardTypeSelect.value = ct.id;
      selectCardType(ct.id);
      showToast(`Registered card type: ${ct.name}`, 'success');

      // Clear inputs
      customSchema.value = '';
      customFront.value = '';
      customBack.value = '';
      customCss.value = '';
    } catch (err) {
      showToast(err.message, 'error', 6000);
    }
  });
}

/**
 * Auto-select a card type (e.g., on initial load).
 */
export function autoSelect(id) {
  cardTypeSelect.value = id;
  selectCardType(id);
}

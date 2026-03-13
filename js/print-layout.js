/**
 * Print Layout module — builds a 3x3 card grid for US Letter printing.
 *
 * REQ-072: Pages are generated in batches via requestAnimationFrame so the
 * main thread isn't blocked for large decks (100+ cards = 10+ pages).
 */
import { renderCard } from './template-renderer.js';

const CARDS_PER_PAGE = 9;
const COLS = 3;
const PAGES_PER_CHUNK = 3; // pages rendered per rAF tick

let _cancelPrint = null; // cancel handle for in-progress generation

/**
 * Build the print layout in #print-area.
 * For large decks (>= 3 pages) renders in chunked rAF batches with a
 * progress indicator so the browser stays responsive.
 *
 * @param {Object} cardType
 * @param {Object[]} rows
 * @param {function(number):void} [onProgress] - called with 0-100 as pages render
 */
export function buildPrintLayout(cardType, rows, onProgress) {
  // Cancel any previous in-progress build
  if (_cancelPrint) { _cancelPrint(); _cancelPrint = null; }

  const printArea = document.getElementById('print-area');
  printArea.innerHTML = '';

  const pageGroups = [];
  for (let start = 0; start < rows.length; start += CARDS_PER_PAGE) {
    pageGroups.push(rows.slice(start, start + CARDS_PER_PAGE));
  }

  const totalPages = pageGroups.length * (cardType.backTemplate ? 2 : 1);

  // Small decks: render synchronously (no rAF overhead)
  if (totalPages <= PAGES_PER_CHUNK) {
    pageGroups.forEach(chunk => renderPageGroup(printArea, cardType, chunk));
    onProgress?.(100);
    return;
  }

  // Large decks: chunked async render
  let groupIdx = 0;
  let pagesRendered = 0;
  let cancelled = false;

  _cancelPrint = () => { cancelled = true; };

  // Show progress indicator
  const progress = _createProgressBar(totalPages);
  printArea.appendChild(progress.el);

  function renderNextChunk() {
    if (cancelled) return;

    const end = Math.min(groupIdx + PAGES_PER_CHUNK, pageGroups.length);
    for (let i = groupIdx; i < end; i++) {
      renderPageGroup(printArea, cardType, pageGroups[i]);
      pagesRendered += cardType.backTemplate ? 2 : 1;
    }
    groupIdx = end;

    const pct = Math.round((pagesRendered / totalPages) * 100);
    progress.update(pct);
    onProgress?.(pct);

    if (groupIdx < pageGroups.length) {
      requestAnimationFrame(renderNextChunk);
    } else {
      progress.el.remove();
      _cancelPrint = null;
    }
  }

  requestAnimationFrame(renderNextChunk);
}

/**
 * Render one page group (front + optional back) into printArea.
 */
function renderPageGroup(printArea, cardType, chunk) {
  // Front page
  const frontPage = document.createElement('div');
  frontPage.className = 'print-page print-fronts';

  for (let i = 0; i < CARDS_PER_PAGE; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'card-wrapper';
    wrapper.dataset.cardType = cardType.id;
    if (i < chunk.length) {
      wrapper.innerHTML = renderCard(cardType.frontTemplate, chunk[i], cardType.fields, cardType);
    }
    frontPage.appendChild(wrapper);
  }

  addCutMarks(frontPage);
  printArea.appendChild(frontPage);

  // Back page (only if card type has a back template)
  if (cardType.backTemplate) {
    const backPage = document.createElement('div');
    backPage.className = 'print-page print-backs';

    // Mirror columns within each row for long-edge flip:
    // Row 0: [2,1,0], Row 1: [5,4,3], Row 2: [8,7,6]
    for (let row = 0; row < 3; row++) {
      for (let col = COLS - 1; col >= 0; col--) {
        const idx = row * COLS + col;
        const wrapper = document.createElement('div');
        wrapper.className = 'card-wrapper';
        wrapper.dataset.cardType = cardType.id;
        if (idx < chunk.length) {
          wrapper.innerHTML = renderCard(cardType.backTemplate, chunk[idx], cardType.fields, cardType);
        }
        backPage.appendChild(wrapper);
      }
    }

    addCutMarks(backPage);
    printArea.appendChild(backPage);
  }
}

/**
 * Create a progress bar element for print generation feedback.
 * @param {number} totalPages
 */
function _createProgressBar(_totalPages) {
  const el = document.createElement('div');
  el.className = 'print-progress';
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.setAttribute('aria-valuenow', '0');
  el.innerHTML = `
    <div class="print-progress-inner">
      <span class="print-progress-label">Preparing print layout…</span>
      <div class="print-progress-bar"><div class="print-progress-fill" style="width:0%"></div></div>
    </div>`;

  const fill = el.querySelector('.print-progress-fill');
  const label = el.querySelector('.print-progress-label');

  return {
    el,
    update(pct) {
      fill.style.width = pct + '%';
      el.setAttribute('aria-valuenow', String(pct));
      label.textContent = `Preparing print layout… ${pct}%`;
    },
  };
}

/**
 * Add cut marks to a print page.
 */
function addCutMarks(pageDiv) {
  const vPositions = [0.5, 3.0, 5.5, 8.0];
  const hPositions = [0.25, 3.75, 7.25, 10.75];

  for (const x of vPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-v top';
    mark.style.left = x + 'in';
    mark.style.top = '0';
    pageDiv.appendChild(mark);
  }

  for (const x of vPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-v bottom';
    mark.style.left = x + 'in';
    mark.style.bottom = '0';
    pageDiv.appendChild(mark);
  }

  for (const y of hPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-h left';
    mark.style.top = y + 'in';
    mark.style.left = '0';
    pageDiv.appendChild(mark);
  }

  for (const y of hPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-h right';
    mark.style.top = y + 'in';
    mark.style.right = '0';
    pageDiv.appendChild(mark);
  }
}

/**
 * Clear the print layout and cancel any in-progress build.
 */
export function clearPrintLayout() {
  if (_cancelPrint) { _cancelPrint(); _cancelPrint = null; }
  const printArea = document.getElementById('print-area');
  if (printArea) printArea.innerHTML = '';
}

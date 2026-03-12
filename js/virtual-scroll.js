/**
 * Virtual scroll for card grid (REQ-071).
 *
 * For decks with 100+ cards, only the visible cards (+ an overscan buffer)
 * are rendered in the DOM. An invisible spacer maintains the correct
 * scroll height so the browser scrollbar stays accurate.
 *
 * Architecture:
 *   - A sentinel <div class="vs-spacer"> fills the total virtual height.
 *   - A window <div class="vs-window"> contains only the rendered cards.
 *   - On scroll, the window is repositioned via transform and cards are
 *     swapped to reflect the new viewport range.
 *
 * Card sizes are fixed per card type (cardType.cardSize), so height
 * calculations are exact without measuring the DOM.
 *
 * Usage:
 *   import { createVirtualGrid, destroyVirtualGrid } from './virtual-scroll.js';
 *   const vs = createVirtualGrid(container, { cardType, rows, onEditCard });
 *   vs.refresh(newRows);  // update data
 *   vs.destroy();
 */

/** Threshold: enable virtual scrolling for decks larger than this. */
export const VS_THRESHOLD = 60;

const OVERSCAN = 2; // extra rows above/below viewport to pre-render

/** Parse CSS length to px (handles mm, in, cm, px). */
function cssToPixels(val) {
  if (!val) return 88; // fallback
  const n = parseFloat(val);
  const unit = val.replace(/[0-9.]/g, '').trim();
  switch (unit) {
    case 'mm': return n * 3.7795275591;
    case 'cm': return n * 37.795275591;
    case 'in': return n * 96;
    case 'pt': return n * (96 / 72);
    default: return n; // px or unitless
  }
}

/**
 * @typedef {Object} VirtualGrid
 * @property {function(Object[]):void} refresh - Update rows and re-render
 * @property {function():void} destroy - Tear down the virtual grid
 * @property {function():number[]} getVisibleIndices - Currently rendered indices
 */

/**
 * Create a virtual-scrolling card grid.
 *
 * @param {HTMLElement} container - The #card-grid element
 * @param {Object} opts
 * @param {Object} opts.cardType
 * @param {Object[]} opts.rows
 * @param {number[]} [opts.filteredIndices] - Optional pre-filtered index list
 * @param {boolean} opts.showBacks
 * @param {function(number, HTMLElement):void} opts.onEditCard
 * @param {function(Object, Object[]): Promise<void>} opts.renderCardHtml - renderCard fn
 * @returns {VirtualGrid}
 */
export function createVirtualGrid(container, opts) {
  const { cardType, onEditCard, renderCardHtml } = opts;

  const cardW = cardType.cardSize?.width || '63.5mm';
  const cardH = cardType.cardSize?.height || '88.9mm';
  const cardPxH = cssToPixels(cardH);
  const GAP = 12; // matches --card-gap in CSS
  const ROW_H = cardPxH + GAP;

  let rows = opts.rows || [];
  let filteredIndices = opts.filteredIndices || null;
  let showBacks = opts.showBacks ?? false;

  // Compute how many columns fit in the container
  // card pair width calculated per-render

  function getIndices() {
    return filteredIndices || rows.map((_, i) => i);
  }

  function getColCount() {
    return Math.max(1, Math.floor((container.offsetWidth + GAP) / (cssToPixels(cardW) * (showBacks ? 2 : 1) + GAP * (showBacks ? 2 : 1))));
  }

  function getTotalRows(indices) {
    return Math.ceil(indices.length / getColCount());
  }

  // DOM structure
  container.setAttribute('role', 'list');
  container.setAttribute('aria-label', 'Card deck');
  container.style.position = 'relative';
  container.style.overflow = 'visible'; // scrolling is on the scroll parent

  const spacer = document.createElement('div');
  spacer.className = 'vs-spacer';
  spacer.style.cssText = 'width:1px;pointer-events:none;';
  container.appendChild(spacer);

  const window_ = document.createElement('div');
  window_.className = 'vs-window';
  window_.style.cssText = 'position:absolute;top:0;left:0;right:0;will-change:transform;';
  container.appendChild(window_);

  let lastFirstRow = -1;
  let lastLastRow = -1;
  let _raf = null;

  function updateSpacerHeight(indices) {
    const totalH = getTotalRows(indices) * ROW_H;
    spacer.style.height = totalH + 'px';
    container.style.minHeight = totalH + 'px';
  }

  function renderWindow(indices, firstRow, lastRow) {
    if (firstRow === lastFirstRow && lastRow === lastLastRow) return;
    lastFirstRow = firstRow;
    lastLastRow = lastRow;

    const cols = getColCount();
    const firstIdx = firstRow * cols;
    const lastIdx = Math.min((lastRow + 1) * cols, indices.length);

    window_.style.transform = `translateY(${firstRow * ROW_H}px)`;
    window_.innerHTML = '';

    for (let i = firstIdx; i < lastIdx; i++) {
      const dataIdx = indices[i];
      const row = rows[dataIdx];
      const pair = document.createElement('div');
      pair.className = 'card-pair';
      pair.setAttribute('role', 'listitem');

      const frontWrapper = document.createElement('div');
      frontWrapper.className = 'card-wrapper';
      frontWrapper.style.width = cardW;
      frontWrapper.style.height = cardH;
      frontWrapper.dataset.cardType = cardType.id;
      frontWrapper.innerHTML = renderCardHtml(cardType.frontTemplate, row, cardType.fields, cardType);
      pair.appendChild(frontWrapper);

      if (showBacks && cardType.backTemplate) {
        const backWrapper = document.createElement('div');
        backWrapper.className = 'card-wrapper card-back-wrapper';
        backWrapper.style.width = cardW;
        backWrapper.style.height = cardH;
        backWrapper.dataset.cardType = cardType.id;
        backWrapper.innerHTML = renderCardHtml(cardType.backTemplate, row, cardType.fields, cardType);
        pair.appendChild(backWrapper);
      }

      const editBtn = document.createElement('button');
      editBtn.className = 'card-edit-btn';
      editBtn.textContent = '\u270E';
      editBtn.title = 'Edit this card';
      editBtn.setAttribute('aria-label', `Edit card ${dataIdx + 1}`);
      editBtn.addEventListener('click', (e) => onEditCard(dataIdx, e.currentTarget));
      pair.appendChild(editBtn);

      window_.appendChild(pair);
    }
  }

  function onScroll() {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(() => {
      const indices = getIndices();
      if (indices.length === 0) return;
      const scrollTop = container.parentElement?.scrollTop ?? window.scrollY;
      const containerTop = container.getBoundingClientRect().top + scrollTop;
      const viewH = container.parentElement?.clientHeight ?? window.innerHeight;
      const relScroll = Math.max(0, scrollTop - containerTop);

      const firstRow = Math.max(0, Math.floor(relScroll / ROW_H) - OVERSCAN);
      const visibleRows = Math.ceil(viewH / ROW_H);
      const lastRow = Math.min(getTotalRows(indices) - 1, firstRow + visibleRows + OVERSCAN * 2);

      renderWindow(indices, firstRow, lastRow);
    });
  }

  // Attach scroll listener to nearest scrollable ancestor
  const scrollParent = findScrollParent(container);
  scrollParent.addEventListener('scroll', onScroll, { passive: true });

  // ResizeObserver to handle container width changes (column reflow)
  let resizeObs = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => {
      lastFirstRow = -1; lastLastRow = -1; // force re-render
      onScroll();
    });
    resizeObs.observe(container);
  }

  function refresh(newRows, newFilteredIndices, newShowBacks) {
    rows = newRows;
    filteredIndices = newFilteredIndices ?? null;
    showBacks = newShowBacks ?? showBacks;
    lastFirstRow = -1; lastLastRow = -1;
    const indices = getIndices();
    updateSpacerHeight(indices);
    onScroll();
  }

  function destroy() {
    scrollParent.removeEventListener('scroll', onScroll);
    resizeObs?.disconnect();
    if (_raf) cancelAnimationFrame(_raf);
    container.innerHTML = '';
    container.style.position = '';
    container.style.minHeight = '';
  }

  function getVisibleIndices() {
    const indices = getIndices();
    const cols = getColCount();
    const start = lastFirstRow * cols;
    const end = Math.min((lastLastRow + 1) * cols, indices.length);
    return indices.slice(start, end);
  }

  // Initial render
  const initialIndices = getIndices();
  updateSpacerHeight(initialIndices);
  onScroll();

  return { refresh, destroy, getVisibleIndices };
}

/**
 * Find the nearest scrollable ancestor.
 * @param {HTMLElement} el
 * @returns {HTMLElement|Window}
 */
function findScrollParent(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflow, overflowY } = window.getComputedStyle(node);
    if (/auto|scroll/.test(overflow + overflowY)) return node;
    node = node.parentElement;
  }
  return window;
}

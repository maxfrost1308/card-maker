/**
 * Virtual scroll for card grid (REQ-071).
 *
 * Renders only cards near the viewport. Uses CSS flex-wrap for layout
 * so multiple cards appear per row at any zoom level, identical to the
 * non-virtual rendering.
 *
 * Architecture:
 *   - A vs-spacer <div> fills the total virtual height so the scrollbar
 *     stays accurate.
 *   - A vs-window <div> (display:flex flex-wrap) sits at position:absolute
 *     and is shifted down with translateY to the current viewport slice.
 *   - Column count is derived from the container's actual width and the
 *     card's CSS pixel width, so it matches the flex layout exactly.
 */

import { escapeHtml } from './template-renderer.js';

export const VS_THRESHOLD = 60;

const OVERSCAN_ROWS = 2; // extra rows above/below to pre-render

function cssToPixels(val) {
  if (!val) return 89; // ~88.9mm standard card height at 96 CSS-px-per-inch
  const n = parseFloat(val);
  const unit = val.replace(/[0-9.]/g, '').trim();
  switch (unit) {
    case 'mm':
      return n * 3.7795275591;
    case 'cm':
      return n * 37.795275591;
    case 'in':
      return n * 96;
    case 'pt':
      return n * (96 / 72);
    default:
      return n;
  }
}

export function createVirtualGrid(container, opts) {
  const { cardType, onEditCard, renderCardHtml } = opts;

  const cardW = cardType.cardSize?.width || '63.5mm';
  const cardH = cardType.cardSize?.height || '88.9mm';
  const cardPxW = cssToPixels(cardW);
  const cardPxH = cssToPixels(cardH);
  // Matches --card-gap in CSS (12px)
  const GAP = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--card-gap') || '12');
  const ROW_H = cardPxH + GAP;

  let rows = opts.rows || [];
  let filteredIndices = opts.filteredIndices || null;
  let showBacks = opts.showBacks ?? false;
  let overlayMode = opts.overlayMode ?? false;

  function getIndices() {
    return filteredIndices || rows.map((_, i) => i);
  }

  function getColCount() {
    const w = container.offsetWidth || window.innerWidth;
    const pairW = cardPxW * (showBacks ? 2 : 1) + GAP * (showBacks ? 1 : 0) + GAP;
    return Math.max(1, Math.floor((w + GAP) / pairW));
  }

  // DOM: spacer maintains scroll height, window contains rendered rows
  container.setAttribute('role', 'list');
  container.setAttribute('aria-label', 'Card deck');
  container.style.position = 'relative';

  const spacer = document.createElement('div');
  spacer.className = 'vs-spacer';
  container.appendChild(spacer);

  const windowEl = document.createElement('div');
  windowEl.className = 'vs-window';
  container.appendChild(windowEl);

  let _lastRange = '';
  let _raf = null;

  function updateSpacerHeight(indices) {
    const rows_ = Math.ceil(indices.length / getColCount());
    const h = rows_ * ROW_H;
    spacer.style.height = h + 'px';
    container.style.minHeight = h + 'px';
  }

  function buildCard(dataIdx) {
    const row = rows[dataIdx];
    const pair = document.createElement('div');
    pair.className = 'card-pair';
    pair.setAttribute('role', 'listitem');

    const front = document.createElement('div');
    front.className = 'card-wrapper';
    front.style.width = cardW;
    front.style.height = cardH;
    front.dataset.cardType = cardType.id;
    front.innerHTML = renderCardHtml(cardType.frontTemplate, row, cardType.fields, cardType);

    // Overlay: show field data on top of card when overlay mode is active
    if (overlayMode) {
      const overlay = document.createElement('div');
      overlay.className = 'card-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      const lines = cardType.fields
        .filter((f) => row[f.key] && String(row[f.key]).trim())
        .slice(0, 6)
        .map(
          (f) =>
            `<div class="overlay-field"><span class="overlay-label">${escapeHtml(f.label)}</span><span class="overlay-value">${escapeHtml(String(row[f.key]).slice(0, 40))}</span></div>`,
        )
        .join('');
      overlay.innerHTML = lines;
      front.appendChild(overlay);
    }

    // Edit button inside card wrapper (hover to reveal)
    const editBtn = document.createElement('button');
    editBtn.className = 'card-edit-btn';
    editBtn.textContent = '\u270E';
    editBtn.title = 'Edit this card';
    editBtn.setAttribute('aria-label', `Edit card ${dataIdx + 1}`);
    editBtn.addEventListener('click', () => onEditCard(dataIdx, editBtn));
    front.appendChild(editBtn);

    pair.appendChild(front);

    if (showBacks && cardType.backTemplate) {
      const back = document.createElement('div');
      back.className = 'card-wrapper card-back-wrapper';
      back.style.width = cardW;
      back.style.height = cardH;
      back.dataset.cardType = cardType.id;
      back.innerHTML = renderCardHtml(cardType.backTemplate, row, cardType.fields, cardType);
      pair.appendChild(back);
    }

    return pair;
  }

  function renderWindow(indices) {
    const scrollParentEl = scrollParent === window ? document.documentElement : scrollParent;
    const scrollTop = scrollParentEl.scrollTop ?? 0;
    const containerTop = container.getBoundingClientRect().top + scrollTop;
    const viewH = scrollParentEl.clientHeight || window.innerHeight;
    const relScroll = Math.max(0, scrollTop - containerTop);

    const cols = getColCount();
    const totalRows = Math.ceil(indices.length / cols);

    const firstRow = Math.max(0, Math.floor(relScroll / ROW_H) - OVERSCAN_ROWS);
    const visibleRowCount = Math.ceil(viewH / ROW_H);
    const lastRow = Math.min(totalRows - 1, firstRow + visibleRowCount + OVERSCAN_ROWS * 2);

    const rangeKey = `${firstRow}-${lastRow}-${cols}`;
    if (rangeKey === _lastRange) return;
    _lastRange = rangeKey;

    windowEl.style.transform = `translateY(${firstRow * ROW_H}px)`;
    windowEl.innerHTML = '';

    const firstIdx = firstRow * cols;
    const lastIdx = Math.min((lastRow + 1) * cols, indices.length);
    for (let i = firstIdx; i < lastIdx; i++) {
      windowEl.appendChild(buildCard(indices[i]));
    }
  }

  function onScroll() {
    if (_raf) cancelAnimationFrame(_raf);
    _raf = requestAnimationFrame(() => renderWindow(getIndices()));
  }

  const scrollParent = findScrollParent(container);
  const scrollTarget = scrollParent === window ? window : scrollParent;
  scrollTarget.addEventListener('scroll', onScroll, { passive: true });

  let resizeObs = null;
  if (typeof ResizeObserver !== 'undefined') {
    resizeObs = new ResizeObserver(() => {
      _lastRange = '';
      onScroll();
    });
    resizeObs.observe(container);
  }

  function refresh(newRows, newFilteredIndices, newShowBacks, newOverlayMode) {
    rows = newRows;
    filteredIndices = newFilteredIndices ?? null;
    showBacks = newShowBacks ?? showBacks;
    overlayMode = newOverlayMode ?? overlayMode;
    _lastRange = '';
    updateSpacerHeight(getIndices());
    onScroll();
  }

  function destroy() {
    scrollTarget.removeEventListener('scroll', onScroll);
    resizeObs?.disconnect();
    if (_raf) cancelAnimationFrame(_raf);
    container.innerHTML = '';
    container.style.position = '';
    container.style.minHeight = '';
  }

  // Initial render
  updateSpacerHeight(getIndices());
  onScroll();

  return { refresh, destroy };
}

function findScrollParent(el) {
  let node = el.parentElement;
  while (node && node !== document.body) {
    const { overflow, overflowY } = window.getComputedStyle(node);
    if (/auto|scroll/.test(overflow + overflowY)) return node;
    node = node.parentElement;
  }
  return window;
}

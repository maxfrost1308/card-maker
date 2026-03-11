/**
 * Print Layout module — builds a 3x3 card grid for US Letter printing.
 */
import { renderCard } from './template-renderer.js';

const CARDS_PER_PAGE = 9;
const COLS = 3;

/**
 * Build the print layout in #print-area.
 */
export function buildPrintLayout(cardType, rows) {
  const printArea = document.getElementById('print-area');
  printArea.innerHTML = '';

  // Chunk rows into groups of 9
  for (let start = 0; start < rows.length; start += CARDS_PER_PAGE) {
    const chunk = rows.slice(start, start + CARDS_PER_PAGE);

    // Front page
    const frontPage = document.createElement('div');
    frontPage.className = 'print-page print-fronts';

    for (let i = 0; i < CARDS_PER_PAGE; i++) {
      const wrapper = document.createElement('div');
      wrapper.className = 'card-wrapper';
      wrapper.dataset.cardType = cardType.id;
      if (i < chunk.length) {
        wrapper.innerHTML = renderCard(cardType.frontTemplate, chunk[i], cardType.fields);
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
            wrapper.innerHTML = renderCard(cardType.backTemplate, chunk[idx], cardType.fields);
          }
          backPage.appendChild(wrapper);
        }
      }

      addCutMarks(backPage);
      printArea.appendChild(backPage);
    }
  }
}

/**
 * Add cut marks to a print page.
 * Vertical marks at top/bottom edges, horizontal marks at left/right edges.
 */
function addCutMarks(pageDiv) {
  // Vertical cut mark x-positions (left edge of each column boundary)
  // Page padding: 0.5in left. Columns at 0.5, 3.0, 5.5, 8.0in
  const vPositions = [0.5, 3.0, 5.5, 8.0];
  // Horizontal cut mark y-positions
  // Page padding: 0.25in top. Rows at 0.25, 3.75, 7.25, 10.75in
  const hPositions = [0.25, 3.75, 7.25, 10.75];

  // Top vertical marks
  for (const x of vPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-v top';
    mark.style.left = x + 'in';
    mark.style.top = '0';
    pageDiv.appendChild(mark);
  }

  // Bottom vertical marks
  for (const x of vPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-v bottom';
    mark.style.left = x + 'in';
    mark.style.bottom = '0';
    pageDiv.appendChild(mark);
  }

  // Left horizontal marks
  for (const y of hPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-h left';
    mark.style.top = y + 'in';
    mark.style.left = '0';
    pageDiv.appendChild(mark);
  }

  // Right horizontal marks
  for (const y of hPositions) {
    const mark = document.createElement('div');
    mark.className = 'cut-mark cut-mark-h right';
    mark.style.top = y + 'in';
    mark.style.right = '0';
    pageDiv.appendChild(mark);
  }
}

/**
 * Clear the print layout.
 */
export function clearPrintLayout() {
  const printArea = document.getElementById('print-area');
  if (printArea) printArea.innerHTML = '';
}

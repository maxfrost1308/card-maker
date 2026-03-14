# Requirements Log

Tracks all product requirement changes (E2E test modifications) with justifications.
See `CLAUDE.md` for the development workflow that uses this log.

## Initial Baseline

**Date:** 2026-03-14
**Action:** E2E test suite restructured from 6 technical-concern files to 10 product-area files.

### Spec Files & Requirement Counts

| Spec File | Requirements | Area |
|-----------|-------------|------|
| `01-card-type-panel.spec.js` | 12 | Card type selection, CSV upload, custom types |
| `02-top-panel.spec.js` | 22 | Header actions: view toggle, overlay, add card, save, export, print, dark mode |
| `03-sub-header-panel.spec.js` | 14 | Search, column filters, aggregation stats, column selector |
| `04-cards-view.spec.js` | 10 | Card rendering, fronts & backs, empty state, virtual scrolling |
| `05-table-view.spec.js` | 14 | Table headers, sorting, bulk selection, cell rendering by data type |
| `06-table-cell-editing.spec.js` | 12 | Inline cell editing per data type, keyboard navigation, undo/redo |
| `07-editing-modal.spec.js` | 16 | Edit modal: open/close, navigation, field editing, save, duplicate, verification |
| `08-export-persistence.spec.js` | 6 | Deck export/import, CSV downloads, IndexedDB persistence |
| `09-accessibility.spec.js` | 13 | AXE-core WCAG, focus management, ARIA, keyboard shortcuts, contrast |
| `10-edge-cases.spec.js` | 12 | CSV edge cases, XSS sanitization, card type switching |
| **Total** | **~131** | |

## Change Log

| Date | Spec File | Requirement | Action | Justification |
|------|-----------|-------------|--------|---------------|
| 2026-03-14 | all | — | Created | Initial requirements baseline from product experience analysis |
| 2026-03-14 | `03-sub-header-panel.spec.js` | filter bar stays visible below app header when scrolling | Added | Filter controls were hidden behind the sticky app header when scrolling due to incorrect sticky top offsets and DOM placement |

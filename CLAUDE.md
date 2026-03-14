# CLAUDE.md — Card Maker Development Guide

## Project Overview

Card Maker is an offline-first web application for creating, editing, and printing custom cards from CSV data. Users select or upload a card type (schema + templates), load CSV data, and view cards in a visual grid or data table. Cards can be edited individually or in bulk, filtered, sorted, and exported as PDF, PNG, or shareable deck files.

**Tech stack:** Vanilla JavaScript (ES modules), Vite (dev server + build), PapaParse (CSV parsing). No framework — direct DOM manipulation throughout.

## Architecture

```
app.js              → Entry point: registers card types, restores session, calls bindEvents()
ui.js               → View orchestration: card grid rendering, event binding, keyboard shortcuts
sidebar.js          → Card type selection, field reference display, sidebar toggle
table-view.js       → Data table: sorting, filtering, cell rendering, inline editing, bulk selection
edit-view.js        → Edit modal: form building, save, duplicate, navigation, focus trap
state.js            → Central data store: getData/setData/setRowData + callback registration
deck-filter.js      → Shared filter state (search query) across card and table views
file-io.js          → CSV loading/saving, File System Access API, downloads
storage.js          → IndexedDB session persistence (debounced auto-save)
template-renderer.js → Mustache-like template compilation and rendering
card-type-registry.js → Card type registration, validation, built-in type loading
table/pill-picker.js → Pill picker and tag picker components for select/multi-select/tags
undo-stack.js       → Command-based undo/redo (max 50 entries)
focus-trap.js       → Focus trap utility for modals
virtual-scroll.js   → Virtual scrolling for large decks (60+ cards)
print-layout.js     → 3×3 print grid layout for US Letter
toast.js            → Toast notification system
qr-code.js          → QR code SVG generation
icon-loader.js      → game-icons.net SVG icon preloading
```

### CSS Files

```
css/app.css          → Global layout, sidebar, header, cards, dark mode
css/table-view.css   → Table, filter bar, column prefs, inline editing, pills
css/edit-view.css    → Edit modal and bulk edit modal
css/print.css        → Print layout overrides
```

### Z-Index Layers

Several elements use `position: sticky` or `position: absolute`. This table tracks
the stacking order to prevent overlap bugs.

| Layer | Z-Index | Element | Position | Notes |
|-------|---------|---------|----------|-------|
| Table header | 20 | `.data-table th` | sticky, top: 0 | Column headers stick on scroll |
| Controls bar | 30 | `.table-controls` | sticky, top: 0 | Must be above table header |
| Dropdowns | 50 | `.filter-bar-dropdown`, `.col-prefs-dropdown`, `.tag-picker-dropdown` | absolute | Positioned from parent |
| Modals | — | `#edit-modal`, `#bulk-edit-modal` | fixed | Full-screen overlays via `hidden` attr |

**Circular dependency avoidance:** `state.js` provides accessor functions (`getData`, `setRowData`, `rerenderActiveView`) so that `table-view.js` and `edit-view.js` don't import from `ui.js`.

## Key Concepts

### Card Types
JSON schema at `card-types/<id>/card-type.json` with fields, templates, and styles:
- **Built-in:** Plant Care, TTRPG
- **Custom:** Upload a single JSON bundle file

### Field Types
`text`, `text-long`, `number`, `select`, `multi-select`, `tags`, `url`, `image`, `icon`, `qr`, `hidden`

### Template Syntax
```
{{field}}              — HTML-escaped value
{{{field}}}            — Raw HTML (no escaping)
{{#field}}...{{/field}} — Truthy/array iteration
{{^field}}...{{/field}} — Inverted (falsy/empty)
{{{icon:field}}}       — Inline SVG icon
{{{qr:field}}}         — Inline QR code SVG
```

### Pill/Tag Rendering
- `select` and `multi-select` fields render as colored pills in table cells
- Colors from `pillColors` in schema or `hashTagColor()` for tags
- Inline editing uses `createPillPicker()` / `createTagPicker()` from `table/pill-picker.js`

## DOM IDs & Selectors (for test authoring)

| Element | Selector |
|---------|----------|
| Card type dropdown | `#card-type-select` |
| CSV file input | `input[type="file"][accept*=".csv"]` |
| Open CSV button | `#open-csv-btn` |
| Save button | `#save-btn` |
| Card grid | `#card-grid` |
| Table view | `#table-view` |
| View toggle buttons | `.view-btn[data-view="cards\|table"]` |
| Overlay button | `#overlay-toggle-btn` |
| Add Card button | `#add-card-btn` |
| Show Backs checkbox | `#show-backs` |
| Print button | `#print-btn` |
| Dark mode toggle | `#dark-mode-toggle` |
| Export menu button | `#export-menu-btn` |
| Export menu | `#export-menu` |
| Edit modal | `#edit-modal` (role=dialog) |
| Edit title | `#edit-title` |
| Bulk edit modal | `#bulk-edit-modal` |
| Toast | `#toast` (aria-live=polite) |
| Table global search | `.table-global-filter` |
| Filter bar | `.filter-bar` |
| Column prefs button | `.table-col-prefs-btn` |
| Row count | `.table-row-count` |
| Aggregation bar | `.table-aggregation-bar` |
| Table cell navigation | `td[data-nav-row][data-nav-col]` |

## Requirements-Driven Development Workflow

### Tests ARE Requirements
Each E2E test is a named product requirement. The test suite is the single source of truth for "what the product should do." Test names describe user-facing behavior, not code internals.

### Development Loop — MANDATORY (never skip steps)

**CRITICAL: You MUST NOT read, investigate, or modify any source code (non-test files) before completing steps 1–3. This is a hard gate, not a suggestion. Do NOT open source files to "understand the bug" — the test must come first.**

1. **Receive task** — feature request, bug report, or refactor. If the description is ambiguous, incomplete, or could lead to multiple interpretations, **stop and ask clarifying questions** before proceeding. Specifically ask about: the exact user interaction or steps to reproduce, the expected vs. actual behavior, which view/component is affected (card grid, table, edit modal, etc.), and any browser or viewport context that matters. Do NOT guess or assume — a wrong assumption leads to a wrong test.
2. **Identify the test gap FIRST** — Do NOT read or explore source code yet. Based solely on the task description and the test file table below, determine which spec file covers this area. Read that spec file to understand existing coverage. Ask: "If this bug existed, would any existing test fail?" If the answer is no, there is a missing requirement. You may ONLY read test files, fixture files, and helper files during this step — never application source code.
3. **Write the failing test** — add or modify the test that describes the desired behavior. Run it and **confirm it fails** (red). If it already passes, your test isn't testing the right thing — revise it. Do NOT proceed until you have a genuinely failing test. You still must not have read any source code at this point.
4. **Make code changes** — NOW you may read source code. Investigate the root cause and implement the fix/feature until the new test passes (green).
5. **Run the full suite** — ensure ALL requirements (old + new) pass. Fix any regressions before proceeding.
6. **Report** — document in `REQUIREMENTS_LOG.md`:
   - Any existing requirements that had to be modified (with justification)
   - Any new requirements added
   - Whether the change was additive or required trade-offs

### Requirement Change Rules
- **Never silently modify a test** to make it pass. If a test must change, log the reason in `REQUIREMENTS_LOG.md`.
- A failing OLD test means either: (a) you introduced a regression → fix the code, or (b) the requirement genuinely changed → document WHY
- **Never commit a fix without a corresponding test.** If you cannot write a test for the change, explain why in `REQUIREMENTS_LOG.md` before proceeding.

## Testing

### Unit Tests (Vitest + jsdom)
- Location: `tests/unit/`, `tests/integration/`
- Run: `npm test` or `npm run test:coverage`
- Coverage thresholds: 60% overall, 80% for core modules

### E2E Tests (Playwright)
- Location: `e2e/`
- Run: `npx playwright test` or `npx playwright test --project=chromium`
- **IMPORTANT: Tests must only run against localhost (http://localhost:5173). NEVER test against the deployed GitHub Pages site** (`https://maxfrost1308.github.io/card-maker/`) as it is used for visual testing on different branches.
- Helpers: `e2e/helpers/fixtures.js`, `e2e/helpers/navigation.js`
- Fixtures: `e2e/fixtures/` (CSV test data)

### Test File Organization (by product area)
| File | Area |
|------|------|
| `01-card-type-panel.spec.js` | Card type selection, CSV upload, custom types |
| `02-top-panel.spec.js` | Cards/Table toggle, overlay, add card, save, export, print, dark mode |
| `03-sub-header-panel.spec.js` | Search, column filters, aggregation stats, column selector |
| `04-cards-view.spec.js` | Card rendering, fronts & backs, empty state, large datasets |
| `05-table-view.spec.js` | Table headers, sorting, bulk selection, cell rendering per data type |
| `06-table-cell-editing.spec.js` | Inline editing for each data type, keyboard nav, undo/redo |
| `07-editing-modal.spec.js` | Edit modal: open/close, navigation, field editing, save, duplicate, verification |
| `08-export-persistence.spec.js` | Deck export/import, CSV downloads, IndexedDB session persistence |
| `09-accessibility.spec.js` | AXE-core scans, focus management, ARIA, keyboard shortcuts, contrast |
| `10-edge-cases.spec.js` | CSV edge cases, XSS sanitization, card type switching |

## Common Commands

```bash
npm run dev           # Start Vite dev server (http://localhost:5173)
npm test              # Run unit tests
npm run test:coverage # Run unit tests with coverage
npm run lint          # ESLint
npm run format        # Prettier formatting
npm run build         # Production build
npx playwright test   # Run all E2E tests
npx playwright test --project=chromium  # Chromium only
npx playwright test e2e/03-sub-header-panel.spec.js  # Single file
```

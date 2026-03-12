# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.4.0] — 2026-03-12
### Added
- REQ-071: Virtual scrolling for large card grids (60+ cards) — only visible cards rendered in DOM, spacer maintains scroll height
- REQ-072: Chunked print layout generation with `requestAnimationFrame` — browser stays responsive for large decks; progress bar shown for 3+ page jobs

## [1.3.0] — 2026-03-12
### Added
- REQ-022: `ui.js` (777 lines) decomposed into `file-io.js` + `sidebar.js` + lean orchestration layer
- REQ-054: Dark mode — `html.dark` CSS overrides, OS preference detection, manual toggle (🌙/☀️), persisted in localStorage
- REQ-055: Undo/redo (Ctrl+Z / Ctrl+Shift+Z) via `undo-stack.js`, wired into edit modal saves and table cell commits (max 50 entries)
- REQ-061: Duplicate card button in edit modal footer — clones row, opens modal for copy, fully undoable
- REQ-062: IndexedDB auto-save (debounced 1s after every mutation) with 7-day session restore on startup
- REQ-063: PNG export per card packed into ZIP using html-to-image + jszip (loaded on demand, graceful fallback)
- REQ-064: Deck import/export as `.cardmaker` JSON (schema + templates + CSS + data in one file)
- REQ-046: PWA — `manifest.json`, service worker with cache-first strategy, offline support

## [1.2.0] — 2026-03-12
### Added
- REQ-070: Template compilation/caching — parsed to segment functions, ~zero regex cost on repeat renders
- REQ-021: Extracted `js/table/pill-picker.js` from `table-view.js` (1161 → 933 lines)
- REQ-004: `vite.config.js` — `npm run build` produces optimised `dist/`
- REQ-050: Drag-and-drop CSV upload with visual drop zone overlay
- REQ-051: Loading spinner during icon preload (`role=status`, `aria-live=polite`)
- REQ-052: Rich empty state — SVG illustration, "Try with sample data" button, drag hint
- REQ-060: "Add card" (+) button at end of card grid
- REQ-065: Card view search bar (Ctrl+F, debounced 150ms)
- REQ-042: Keyboard navigation in table view (arrow keys, Enter to edit, Escape to cancel)
- REQ-053: Keyboard shortcuts panel — Ctrl+S/P/F, `?` to toggle shortcuts modal

## [1.1.0] — 2026-03-12
### Added
- REQ-015: Integration tests for core workflows (10 tests)
- REQ-016: Per-file coverage thresholds (80% for template-renderer, csv-parser, qr-code)
- REQ-056: CSV mismatch toast when zero CSV columns match schema fields
- REQ-081: Upload validation — field key/name type checks, `Array.isArray(options)`, `<script>` tag warning
- REQ-082: CSS sanitization (strip `@import` and external `url()`), CSP meta tag
- REQ-024: `js/state.js` (shared data store) and `js/toast.js` (extracted `showToast`)
- REQ-040: ARIA attributes — `role=dialog/aria-modal` on edit modal, `role=complementary` on sidebar, `role=status/aria-live` on toast, `role=list` on card grid
- REQ-041: Focus trap in edit modal (WCAG 2.1 compliant)
- REQ-043: `--text-muted` contrast fix `#777` → `#666`
- REQ-044: Skip navigation link
- REQ-020: JSDoc on all new modules and key public APIs
- REQ-032: `docs/card-type-authoring.md` — complete authoring guide

## [1.0.0] — 2026-03-12

### Added

#### Core Application
- CSV-driven card rendering engine with Mustache-like template syntax
- Card view with front/back display and print-ready layout (3×3 grid, cut marks)
- Table view with inline cell editing, column sorting, and multi-field filtering
- Edit modal with rich field editors: text, select, multi-select, tags, URL, image, number, icon, QR
- Pill picker component for multi-select and tags fields
- Tag autocomplete based on existing values in the dataset
- Verified-field tracking per card
- "Show backs" toggle in card view

#### Card Type System
- Card type registry with schema validation
- Built-in: **Plant Care** — printable care labels with water/light/humidity fields
- Built-in: **TTRPG** — monster/item cards with icon support, stat blocks, and rarity colors
- Custom card type upload (JSON schema + HTML templates + CSS)
- `colorMapping` support for deriving field values from other fields
- `aggregations` support for summary statistics
- Card size configuration (default: poker card 63.5mm × 88.9mm)

#### Template Engine
- `{{field}}` — HTML-escaped value substitution
- `{{{field}}}` — raw value substitution
- `{{#field}}...{{/field}}` — conditional blocks and array iteration
- `{{^field}}...{{/field}}` — inverted (empty) blocks
- `{{.}}` / `{{@index}}` — array item and index access
- `{{{icon:field}}}` — inline icons from game-icons.net
- `{{{qr:field}}}` — inline QR code SVGs
- `_lower` CSS class variants for all fields

#### Data Handling
- CSV parsing with PapaParse (header trimming, ragged row tolerance)
- Header remapping by key, label, or case-insensitive label
- CSV generation for template/sample downloads
- File System Access API integration for in-place save (Chromium)
- Fallback download for non-Chromium browsers
- Starter file generator (download blank CSV or schema template)

#### Developer Experience
- `package.json` with npm scripts: `dev`, `start`, `build`, `lint`, `format`, `test`, `test:coverage`
- Vite dev server with HMR
- ESLint (flat config) + Prettier
- Vitest test suite: 79 unit tests across template-renderer, csv-parser, qr-code, card-type-registry
- GitHub Actions CI (lint + test on Node 20)
- GitHub Pages deployment workflow
- MIT license

[1.0.0]: https://github.com/maxfrost1308/card-maker/releases/tag/v1.0.0

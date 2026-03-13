# Card Maker — Open-Source Release Requirements

## Summary

Card Maker is a well-structured, functional ~4,500-line vanilla JavaScript application for designing, editing, and printing custom cards from CSV data. The codebase demonstrates solid engineering fundamentals: clean ES module boundaries, sensible separation of concerns (registry, renderer, parser, views), a custom template engine with real utility, and thoughtful UI details like pill pickers, tag autocomplete, and verified-field tracking. The architecture is genuinely good for a personal project of this scale.

The primary gaps for open-source release are infrastructure and developer experience. There are no tests, no package.json, no linting, no CI, no .gitignore, and the README is a single line. The code quality is high enough that most modules can be tested and documented without refactoring — the investment is in wrapping the existing work with professional tooling, not rewriting it. The two largest files (`table-view.js` at 1,091 lines and `ui.js` at 530 lines) are monolithic but internally well-organized with clear section comments; decomposition is a P1 improvement, not a blocker.

Security-wise, the `{{{raw}}}` triple-brace syntax renders unescaped HTML from user CSV data, and custom card type uploads inject arbitrary CSS and HTML templates into the DOM. Both are acceptable for a local-first tool where users control their own data, but should be documented clearly and optionally hardened. The most impactful work is in Phase 1 (infrastructure, tests, docs) which unblocks community contributions, followed by Phase 2 (accessibility, security) which builds trust.

---

## Requirements by Category

### 1. Project Infrastructure & Developer Experience

#### [REQ-001] Initialize package.json and pin dependencies
- **Priority:** P0
- **What:** Create `package.json` with project metadata (name, version, description, license, repository, keywords). Add PapaParse as an explicit dependency. Add dev dependencies for tooling (see subsequent REQs). Add `engines` field specifying Node.js >=18.
- **Why:** Package.json is the universal entry point for any JS project. Without it, contributors can't install tooling, CI can't run, and the project looks unfinished.
- **Preserves:** The vendored `lib/papaparse.min.js` continues to work. No runtime behavior changes.
- **Approach:** Run `npm init` with pre-filled values. Add `papaparse` as a dependency. Keep the vendored copy for now (the app loads it via `<script>` tag, not import). Add a `"type": "module"` field since the codebase uses ES modules.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-002] Add .gitignore and .editorconfig
- **Priority:** P0
- **What:** Create `.gitignore` (node_modules, .DS_Store, *.log, dist/, coverage/, .env) and `.editorconfig` (indent_style=space, indent_size=2, end_of_line=lf, charset=utf-8, trim_trailing_whitespace=true, insert_final_newline=true).
- **Why:** Prevents committing generated files and ensures consistent formatting across editors/OS. Basic hygiene expected of any public repo.
- **Preserves:** All existing files unchanged.
- **Approach:** Standard config files. Match the existing code style (2-space indentation, LF line endings observed throughout).
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-003] Add a local dev server with live reload
- **Priority:** P0
- **What:** Add a lightweight dev server as a dev dependency with an `npm start` script. The server must serve static files from the project root and support live reload on file changes.
- **Why:** Currently, contributors must manually set up a local server (the app uses ES modules which require HTTP, not `file://`). A one-command dev server lowers the barrier to contribution.
- **Preserves:** No changes to application code. The app continues to work as a static site.
- **Approach:** Use `vite` in dev mode (zero-config for static sites, native ES module support, fast HMR). Alternative: `live-server` or `browser-sync` if Vite feels heavy. Vite is preferred because it also enables future build-step improvements (REQ-004) without a second tool. Add `"scripts": { "dev": "vite", "start": "vite" }` to package.json.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-001

#### [REQ-004] Evaluate and configure build/bundle strategy
- **Priority:** P1
- **What:** Configure Vite for optional production builds. The no-build dev workflow must remain functional (opening index.html via any static server still works). The build step produces an optimized `dist/` folder for deployment.
- **Why:** A build step enables: minification for production, potential future TypeScript/JSDoc checking, automated GitHub Pages deployment from `dist/`. But the zero-build simplicity is a genuine feature — contributors should be able to edit HTML/JS/CSS and see changes immediately.
- **Approach:** Add `vite.config.js` with minimal config. Add `"build": "vite build"` and `"preview": "vite preview"` scripts. Keep PapaParse as a vendored `<script>` tag (moving to `import` would be a separate REQ). The `index.html` at root remains the entry point for both dev and build.
- **Preserves:** The app works identically without running any build. Static server deployment continues to work.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-001, REQ-003

#### [REQ-005] Add ESLint and Prettier
- **Priority:** P0
- **What:** Configure ESLint (flat config, `eslint.config.js`) for ES modules with browser globals. Configure Prettier with project conventions. Add `npm run lint` and `npm run format` scripts.
- **Why:** Consistent code style across contributors. Catches common bugs (unused variables, implicit globals). Required for CI.
- **Preserves:** No code changes beyond auto-fixable formatting. Existing code style is already clean — config should match it, not fight it.
- **Approach:** ESLint flat config with `ecmaVersion: 2022`, `sourceType: "module"`, `env: { browser: true }`. Key rules: `no-unused-vars: warn`, `no-undef: error`, `prefer-const: warn`. Prettier config: `singleQuote: true`, `trailingComma: "all"`, `printWidth: 120` (matching observed style). Add `globals` for `Papa` (loaded via script tag). Add `.prettierignore` for `lib/`.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-001

#### [REQ-006] Set up GitHub Actions CI
- **Priority:** P0
- **What:** Create `.github/workflows/ci.yml` that runs on push and PR: lint, run tests (once REQ-010 is done), and optionally build.
- **Why:** CI is table stakes for open source. Prevents broken merges, enforces code quality, and signals professionalism.
- **Preserves:** No application changes.
- **Approach:** Single workflow with Node.js 20 matrix. Steps: checkout, install, lint, test. Add a deploy workflow for GitHub Pages (REQ-045) separately.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-001, REQ-005

---

### 2. Testing Strategy

#### [REQ-010] Select test framework and configure test runner
- **Priority:** P0
- **What:** Install and configure Vitest as the test framework. Set up test file discovery, ES module support, and JSDOM environment for DOM-dependent tests.
- **Why:** The codebase has zero tests. Before any refactoring or feature work, a test harness must exist to prevent regressions. Vitest is chosen because: native ES module support (no transpilation), compatible with the Vite dev server (REQ-003), fast, good DX.
- **Preserves:** No application code changes.
- **Approach:** `npm install -D vitest @vitest/coverage-v8 jsdom`. Add `vitest.config.js` with `environment: 'jsdom'` for UI tests. Convention: `tests/unit/` for pure logic, `tests/integration/` for DOM tests. File naming: `*.test.js`. Add `"test": "vitest run"`, `"test:watch": "vitest"`, `"test:coverage": "vitest run --coverage"` scripts.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-001

#### [REQ-011] Unit tests for template-renderer.js
- **Priority:** P0
- **What:** Write comprehensive unit tests for `preprocessRow()`, `renderTemplate()`, and `renderCard()`. Cover: escaped substitution, raw substitution, section blocks (array iteration, truthy check), inverted blocks, icon substitution, QR substitution, `_lower` CSS class variants, colorMapping derivation, extra CSV columns pass-through.
- **Why:** The template renderer is the core engine. Every card type depends on it. It must be tested before any changes to rendering logic.
- **Preserves:** All existing template syntax must continue to produce identical output.
- **Approach:** Pure function tests — no DOM required. Mock `resolveIconUrl` and `generateQrSvg` imports. Test each regex substitution pattern independently, then test the full pipeline via `renderCard()`. Use snapshot tests for complex template outputs.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-010

#### [REQ-012] Unit tests for csv-parser.js
- **Priority:** P0
- **What:** Write unit tests for `parseCsv()`, `generateCsv()`, and `remapHeaders()`. Cover: basic parsing, header trimming, empty rows, ragged rows (FieldMismatch filtered), quoting/escaping in generateCsv, header remapping by key/label/case-insensitive label, no-op when headers already match.
- **Why:** CSV parsing is the data ingestion layer. Bugs here corrupt all downstream rendering.
- **Preserves:** Existing parsing behavior including the deliberate filtering of FieldMismatch errors.
- **Approach:** `parseCsv` needs PapaParse available. Either mock it or configure the test environment to load it. `generateCsv` and `remapHeaders` are pure functions — straightforward to test. Test edge cases: commas in values, double quotes, newlines in fields, empty CSV, single-row CSV.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-010

#### [REQ-013] Unit tests for qr-code.js
- **Priority:** P1
- **What:** Write tests for `generateQrSvg()`. Verify it produces valid SVG markup, handles various input lengths, and that known inputs produce deterministic outputs.
- **Why:** The QR code generator is a self-contained 405-line algorithm. Snapshot tests lock down correctness before any optimization or refactoring.
- **Preserves:** QR output byte-for-byte identical.
- **Approach:** Snapshot test: generate QR for known URLs, store expected SVG. Test edge cases: empty string, very long URL (should hit version limit gracefully), alphanumeric vs byte mode selection.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-010

#### [REQ-014] Unit tests for card-type-registry.js
- **Priority:** P1
- **What:** Test `register()`, `get()`, `listAll()`, `registerFromUpload()` validation logic. Mock `fetch()` for `registerBuiltIn()`.
- **Why:** The registry is the central data model. Validation logic for user-uploaded schemas must be correct — bad schemas should produce clear error messages.
- **Preserves:** All validation rules (required id, name, fields array, valid field types).
- **Approach:** JSDOM environment for DOM manipulation (style injection). Mock fetch for built-in loading. Test validation: missing id, missing name, invalid field type, empty front template. Test re-registration (should replace old styles).
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-010

#### [REQ-015] Integration tests for core workflows
- **Priority:** P1
- **What:** Write integration tests that exercise: (1) register card type → select → render sample data, (2) load CSV → render cards → verify card count, (3) edit card → save → verify data update, (4) table view rendering with filtering and sorting.
- **Why:** Unit tests cover individual modules; integration tests verify the modules work together correctly.
- **Preserves:** End-to-end behavior of the complete rendering pipeline.
- **Approach:** JSDOM environment with full DOM. Load the actual `index.html` structure or create a minimal fixture. Import modules directly. Use the existing sample data from `card-types/plant-care/sample-data.json` as test fixtures.
- **Estimated Scope:** L (days)
- **Dependencies:** REQ-010, REQ-011, REQ-012

#### [REQ-016] Set coverage targets
- **Priority:** P1
- **What:** Configure Vitest coverage with targets: 80% for pure logic modules (template-renderer, csv-parser, qr-code), 60% overall. Add coverage reporting to CI.
- **Why:** Coverage targets prevent test rot and signal quality to contributors.
- **Preserves:** No application changes.
- **Approach:** Configure `@vitest/coverage-v8`. Add thresholds to vitest.config.js. Generate lcov reports for CI badge integration.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-010, REQ-011, REQ-012

---

### 3. Code Quality & Architecture

#### [REQ-020] Add JSDoc type annotations to all public APIs
- **Priority:** P1
- **What:** Add JSDoc `@param`, `@returns`, and `@typedef` annotations to all exported functions across all modules. Define shared types: `CardType`, `Field`, `Row`, `RowData`.
- **Why:** JSDoc provides IDE autocompletion and documentation without requiring TypeScript migration. It's the lightest-weight approach that delivers immediate value for a vanilla JS project.
- **Preserves:** Zero runtime changes. All exports remain identical.
- **Approach:** Start with shared typedefs in a new `js/types.js` (or JSDoc-only `js/types.d.ts`). Annotate exports in: template-renderer.js (4 exports), csv-parser.js (3 exports), card-type-registry.js (4 exports), ui.js (7 exports), table-view.js (4 exports), edit-view.js (2 exports). Full TypeScript migration is NOT recommended — the codebase is small enough that JSDoc covers the type safety gap without adding build complexity.
- **Estimated Scope:** L (days)
- **Dependencies:** None

#### [REQ-021] Extract table-view.js sub-modules
- **Priority:** P1
- **What:** Decompose `table-view.js` (1,091 lines) into focused sub-modules while preserving its public API. Proposed split: `table-view.js` (orchestration, 200 lines), `table-filters.js` (filter bar, tokens, dropdown — 200 lines), `table-cell-edit.js` (inline editing, cell rendering — 200 lines), `pill-picker.js` (shared pill/tag picker components — 160 lines), `table-sort.js` (sorting logic — 50 lines).
- **Why:** 1,091 lines in one file makes navigation difficult and increases merge conflict risk for contributors.
- **Preserves:** `table-view.js` continues to export `renderTable`, `destroyTable`, `createTagPicker`, `createPillPicker` with identical signatures. Internal imports change but external API is stable.
- **Approach:** Create sub-modules in `js/table/` directory. `table-view.js` re-exports from sub-modules. Move `createTagPicker` and `createPillPicker` to `js/table/pill-picker.js` — these are imported by `edit-view.js`, so the re-export from `table-view.js` must remain. Move incrementally: one sub-module at a time, run tests after each.
- **Estimated Scope:** L (days)
- **Dependencies:** REQ-015 (integration tests must exist first)

#### [REQ-022] Extract ui.js sidebar and file handling
- **Priority:** P2
- **What:** Extract sidebar-specific logic from `ui.js` (530 lines) into `js/sidebar.js` (card type selection, field reference, file state management) and `js/file-io.js` (CSV loading, saving, File System Access API). `ui.js` becomes the orchestration layer.
- **Why:** Reduces cognitive load for contributors. Separates concerns: sidebar UI vs. file I/O vs. card rendering.
- **Preserves:** All exports from `ui.js` remain available. Other modules importing from `ui.js` continue to work.
- **Approach:** Same re-export pattern as REQ-021. Extract `openCsvWithPicker`, `loadCsvFile`, `saveToFile`, `downloadFile` to `file-io.js`. Extract `selectCardType`, `renderFieldReference`, sidebar toggle logic to `sidebar.js`.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-015, REQ-021

#### [REQ-023] Audit and improve error handling
- **Priority:** P1
- **What:** Audit all `catch` blocks and error paths. Identified issues from code review: (1) `registerBuiltIn` — `back.html` fetch uses `.catch(() => null)` which silently swallows network errors, not just 404s. (2) `sample-data.json` fetch catches all errors silently. (3) `parseCsv` resolves even on error (by design, but the error messages could be more descriptive). (4) No validation that CSV headers match any schema fields — loading the wrong CSV produces blank cards with no warning. (5) Icon loading silently falls back to placeholder SVG on any fetch error — no user notification.
- **Why:** Silent failures frustrate users and make debugging difficult. Contributors need clear error paths to understand the codebase.
- **Preserves:** Existing error recovery behavior (graceful degradation). Add user-facing messages where currently silent.
- **Approach:** (1) For `back.html`, check `res.ok` rather than catching all errors. (2) For sample data, add console.warn. (3) Add a warning toast when no CSV headers match schema fields. (4) For icon loading, optionally show a single toast after preload completes if any icons failed. Each fix is 1-5 lines and isolated.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-024] Audit module dependency graph for circular imports
- **Priority:** P1
- **What:** Map and document the module dependency graph. Current analysis reveals a tight coupling concern: `ui.js` imports from `table-view.js` and `edit-view.js`, while `table-view.js` and `edit-view.js` both import from `ui.js` (for `getData`, `setRowData`, `rerenderActiveView`, `showToast`, `getActiveCardType`, `deleteRows`). This bidirectional dependency works because of ES module hoisting, but makes refactoring fragile.
- **Why:** Circular or bidirectional dependencies are a common source of subtle bugs in refactoring and make the architecture harder to understand.
- **Preserves:** All module functionality.
- **Approach:** Introduce a lightweight shared state module `js/state.js` that holds `currentData`, `currentCardType`, and accessor functions (`getData`, `setRowData`, `deleteRows`, `getActiveCardType`). `ui.js`, `table-view.js`, and `edit-view.js` all import from `state.js` instead of from each other. `showToast` moves to a separate `js/toast.js`. This breaks the bidirectional dependency without changing any public API.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-015

---

### 4. Documentation

#### [REQ-030] Rewrite README.md
- **Priority:** P0
- **What:** Write a comprehensive README with: project title and one-line description, feature highlights, screenshot/GIF of the app in action, quick start instructions (clone, npm install, npm start), usage guide (select card type, load CSV, edit, print), built-in card types, custom card type creation overview, template syntax quick reference, tech stack, contributing link, license.
- **Why:** The README is the first thing every visitor sees. The current README is one line. This is the single highest-impact documentation task.
- **Preserves:** N/A (new content).
- **Approach:** Write in Markdown. Include a `docs/` directory for screenshots. Structure: hero section → quick start → features → usage → custom card types → contributing → license.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-031] Write CONTRIBUTING.md
- **Priority:** P0
- **What:** Document: development setup, project structure overview, code style expectations, how to run tests, PR process, how the card type system works (schema + templates + CSS), how to add a new built-in card type.
- **Why:** Contributors need a guide to get productive quickly. Without it, potential contributors bounce.
- **Preserves:** N/A.
- **Approach:** Standard open-source contributing guide. Include a "Project Structure" section with a file tree and one-line descriptions of each module. Reference the code style from ESLint/Prettier config.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-005

#### [REQ-032] Write card type authoring guide
- **Priority:** P1
- **What:** Create `docs/card-type-authoring.md` with: complete schema format documentation (every field type, every property), template syntax reference with examples, CSS scoping rules (`[data-card-type="your-id"]`), card size configuration, colorMapping explained, aggregations explained, sample data format, step-by-step tutorial for creating a new card type.
- **Why:** Custom card types are the extensibility story. If users can't author them, the app's value is limited to built-in types.
- **Preserves:** N/A.
- **Approach:** Extract schema documentation from the code (field types: text, select, multi-select, tags, url, image, number, icon, qr). Document every property: key, label, type, options, pillColors, separator, maxLength, required, hidden, verifiable. Include the plant-care card type as a worked example.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-033] Add LICENSE file
- **Priority:** P0
- **What:** Add an MIT license file. MIT is recommended: it's simple, permissive, widely understood, and compatible with the most downstream uses.
- **Why:** A project without a license is legally "all rights reserved." No one can legally use, modify, or distribute the code.
- **Preserves:** N/A.
- **Approach:** Add `LICENSE` file with MIT text and current year + author name. Add `"license": "MIT"` to package.json.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-001

#### [REQ-034] Set up CHANGELOG
- **Priority:** P1
- **What:** Create `CHANGELOG.md` following Keep a Changelog format. Retroactively document the initial release as v1.0.0 with current features.
- **Why:** Changelogs communicate what changed between versions. Essential for open-source trust and adoption.
- **Preserves:** N/A.
- **Approach:** Use Keep a Changelog format (keepachangelog.com). Categories: Added, Changed, Deprecated, Removed, Fixed, Security.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

---

### 5. Accessibility (a11y)

#### [REQ-040] Add ARIA attributes to dynamic UI components
- **Priority:** P1
- **What:** Add ARIA roles and attributes to: (1) toast notifications — `role="status"` and `aria-live="polite"`, (2) card grid — `role="list"` with `role="listitem"` on card pairs, (3) edit modal — `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, (4) sidebar — `role="complementary"`, `aria-label`, (5) filter bar dropdown — `role="listbox"` with `role="option"`, (6) pill picker — `role="group"` with `aria-label`, (7) column visibility dropdown — `role="menu"`.
- **Why:** Screen readers cannot interpret the UI without ARIA markup. The app currently has zero ARIA attributes beyond the sidebar toggle's `aria-label`.
- **Preserves:** All visual behavior unchanged.
- **Approach:** Add attributes directly to index.html (static elements) and to DOM creation calls in JS modules (dynamic elements). Each component can be updated independently.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-041] Implement focus trapping in edit modal
- **Priority:** P1
- **What:** When the edit modal is open, tab focus must cycle within the modal. Currently, pressing Tab can move focus to elements behind the modal backdrop.
- **Why:** Focus escaping is a WCAG 2.1 failure and a usability issue for keyboard users.
- **Preserves:** Modal open/close behavior, Escape key handling (already implemented).
- **Approach:** Add a focus trap utility function. On modal open, capture the first and last focusable elements. On Tab at the last element, wrap to first; on Shift+Tab at first, wrap to last. On modal close, return focus to the element that triggered the modal (the edit button).
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-042] Add keyboard navigation for table view
- **Priority:** P1
- **What:** Enable keyboard interaction for: (1) cell navigation with arrow keys, (2) Enter to start editing a cell, (3) Escape to cancel editing (already works for input fields, but not for pill pickers), (4) Tab to move between cells in edit mode.
- **Why:** Table view currently requires mouse clicks for every interaction. Keyboard-only users cannot use it.
- **Preserves:** All existing mouse interactions.
- **Approach:** Add `tabindex="0"` to data cells. Add a `keydown` listener on the table body that handles arrow key navigation by tracking the focused cell coordinates. Enter triggers `startCellEdit`. Escape triggers `cancelCellEdit` for all input types.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-043] Audit and fix color contrast
- **Priority:** P1
- **What:** Audit all CSS color combinations against WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text). Known concerns: `--text-muted: #777` on `--bg: #f5f5f5` (3.9:1 — fails AA), pill colors with white text (some like `#d4a017` gold may fail), `.help-text` at 0.75rem with #777.
- **Why:** WCAG AA compliance is the minimum standard for accessible web apps.
- **Preserves:** Overall visual design feel. Colors may shift slightly to meet contrast ratios.
- **Approach:** Use a contrast checking tool to audit all text/background pairs in the four CSS files. Adjust CSS custom properties to meet minimums. The `--text-muted` fix is straightforward: darken to `#666` or `#5a5a5a`. Pill colors need case-by-case review.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-044] Add skip navigation link
- **Priority:** P2
- **What:** Add a visually hidden "Skip to main content" link as the first focusable element that jumps to `.main-area`.
- **Why:** Screen reader and keyboard users should not have to tab through the entire sidebar to reach the main content area.
- **Preserves:** Visual appearance (link is only visible on focus).
- **Approach:** Add an `<a>` as the first child of `<body>` with `href="#card-grid"` and a `.visually-hidden:focus` CSS class that reveals it on focus.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

---

### 6. UX & UI Polish

#### [REQ-050] Add drag-and-drop CSV upload
- **Priority:** P1
- **What:** Allow users to drag a CSV file onto the main area or sidebar to load it. Show a visual drop zone indicator.
- **Why:** Drag-and-drop is the expected interaction pattern for file upload in modern web apps.
- **Preserves:** Existing "Open CSV" button and file input continue to work.
- **Approach:** Add `dragover`, `dragenter`, `dragleave`, `drop` event listeners on `.main-area`. On valid drop, call existing `loadCsvFile()`. Show a semi-transparent overlay with "Drop CSV file here" text during dragover. Filter for `.csv`/`.tsv`/`.txt` file types.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-051] Add loading states for icon preloading
- **Priority:** P1
- **What:** When switching to a card type with icon fields (like TTRPG), show a progress indicator while icons are being preloaded. Currently the card grid sits empty or shows placeholder cards until icons resolve.
- **Why:** Without a loading indicator, users think the app is broken during the icon fetch delay.
- **Preserves:** Existing preload logic in `renderCards()`. Icon loading still happens via `preloadIcons()`.
- **Approach:** Add a simple progress bar or spinner in the card grid area. Show it before `await preloadIcons(iconValues)` in `renderCards()`, hide it after. Use a `<div class="loading-indicator">Loading icons...</div>` element.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-052] Improve empty state and first-time experience
- **Priority:** P1
- **What:** Redesign the empty state to be more inviting. Add: visual illustration or icon, clearer call-to-action ("Choose a card type to get started"), link to card type authoring docs, a "Try it" button that auto-loads plant-care sample data.
- **Why:** The current empty state is two lines of gray text. First impressions matter for open-source adoption.
- **Preserves:** The auto-selection of plant-care on load (REQ already exists in `app.js`). But the empty state is visible when no card type is selected yet.
- **Approach:** Update `renderEmpty()` in `ui.js` with richer HTML. Add CSS for the empty state illustration. Use inline SVG for the illustration (no external dependencies).
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-053] Add keyboard shortcuts documentation and expansion
- **Priority:** P2
- **What:** Document existing shortcuts (Ctrl+S to save, Escape to close modal), add new shortcuts: Ctrl+P for print, arrow keys for card navigation in edit modal (already exists but undiscoverable), Ctrl+F for global table filter focus.
- **Why:** Power users expect keyboard shortcuts. Current ones are undiscoverable.
- **Preserves:** Existing Ctrl+S and Escape behavior.
- **Approach:** Add a "Keyboard Shortcuts" section to README. Add `title` attributes on buttons showing shortcuts. Bind new shortcuts in `bindEvents()`. Add a `?` keyboard shortcut that shows a shortcuts overlay/modal.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-054] Dark mode support
- **Priority:** P2
- **What:** Add a dark color scheme that activates via `prefers-color-scheme: dark` media query, with a manual toggle in the header.
- **Why:** Dark mode is expected in modern applications and reduces eye strain.
- **Preserves:** All current light theme styling as the default.
- **Approach:** The CSS already uses CSS custom properties (`--bg`, `--surface`, `--border`, `--text`, `--text-muted`, `--accent`), which makes dark mode relatively straightforward. Add a `@media (prefers-color-scheme: dark)` block that overrides these properties. Add a toggle button in the header that adds a `data-theme="dark"` attribute to `<html>`. Card type CSS (scoped to `[data-card-type]`) may need per-type dark variants — document this for card type authors.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-043 (color contrast audit first)

#### [REQ-055] Add undo/redo for card edits
- **Priority:** P2
- **What:** Implement undo/redo for data modifications (edit card, delete rows, bulk operations). Bind to Ctrl+Z / Ctrl+Shift+Z.
- **Why:** Destructive operations (especially bulk delete) have no recovery path. Users who accidentally delete cards must reload their CSV.
- **Preserves:** All existing edit and delete functionality.
- **Approach:** Implement a simple command stack in a new `js/undo-stack.js` module. Each data mutation pushes a `{ undo: fn, redo: fn }` entry onto the stack. Limit stack to 50 entries. Wire into `setRowData`, `deleteRows`, and the edit modal save function.
- **Estimated Scope:** L (days)
- **Dependencies:** REQ-024 (state module refactor helps here)

#### [REQ-056] Improve error states for malformed CSV
- **Priority:** P1
- **What:** When a CSV has no matching headers, show a diagnostic toast or modal explaining which headers were found vs. expected, rather than silently rendering blank cards.
- **Why:** Users who load the wrong CSV or use the wrong card type see blank cards with no explanation. This is the most confusing failure mode in the current app.
- **Preserves:** Existing CSV loading and remapping logic.
- **Approach:** After `remapHeaders()`, check if any fields from the schema have matching columns in the data. If zero match, show a detailed error: "None of the CSV columns (x, y, z) match the expected fields for [Card Type]. Expected columns include: a, b, c." If partial match, show a warning with the unmatched fields.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

---

### 7. Feature Completeness & Gaps

#### [REQ-060] Add "Add new card" from card view
- **Priority:** P1
- **What:** Add a "+" button at the end of the card grid that opens the edit modal with a blank card. On save, append the new row to `currentData` and re-render.
- **Why:** Currently, adding new cards requires switching to table view or editing the CSV externally.
- **Preserves:** Existing edit modal functionality. New cards go through the same save path as edited cards.
- **Approach:** Add an "add card" button as the last element in the card grid (styled as a card-sized dashed border box). On click, push an empty row object to `currentData`, then open `openEditModal(currentData.length - 1)`.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

#### [REQ-061] Add "Duplicate card" action
- **Priority:** P2
- **What:** Add a "Duplicate" button to the edit modal footer (next to Save/Cancel) that clones the current card's data as a new row.
- **Why:** Common workflow — users want to create similar cards with minor variations.
- **Preserves:** Existing edit modal layout and save behavior.
- **Approach:** Clone the current row data (`{ ...currentRow }`), push to `currentData`, re-render, and open the edit modal for the new card.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-060

#### [REQ-062] Add persistent storage with IndexedDB
- **Priority:** P2
- **What:** Auto-save the current state (selected card type, loaded data, file handle name) to IndexedDB. On page load, offer to restore the previous session.
- **Why:** Refreshing the page loses all loaded data. For a tool users may leave open for hours, this is a significant UX gap.
- **Preserves:** Existing workflow (CSV remains the source of truth). Session restore is opt-in via a "Restore previous session?" prompt.
- **Approach:** New `js/storage.js` module using the IndexedDB API directly (no library needed for this scope). Store: card type ID, CSV data as JSON, timestamp. On load, check for stored state. Show a toast: "Previous session found — [Restore] [Dismiss]." Clear stored state when the user explicitly loads a new CSV.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-024 (state module)

#### [REQ-063] Export cards as PNG images
- **Priority:** P2
- **What:** Add an "Export as PNG" option that renders individual card fronts (and optionally backs) as PNG images and downloads them as a ZIP.
- **Why:** Users want to share individual cards digitally, not just print physical decks.
- **Preserves:** Existing print layout functionality.
- **Approach:** Use `html2canvas` library (or the native `html-to-image` approach with SVG foreignObject). Render each `.card-wrapper` to canvas, then `canvas.toBlob()`. Package into a ZIP using JSZip. Add as a dropdown option next to the "Print / PDF" button.
- **Estimated Scope:** L (days)
- **Dependencies:** None

#### [REQ-064] Import/export complete deck state
- **Priority:** P2
- **What:** Allow exporting the complete deck (card type schema + templates + CSS + data) as a single `.cardmaker` JSON file. Allow importing such files to restore a full deck with its card type.
- **Why:** Makes it easy to share complete decks with other users without needing to separately share the card type and data.
- **Preserves:** Existing CSV import/export.
- **Approach:** The export file is a JSON object containing: `{ schema, frontTemplate, backTemplate, css, data }`. Import reads the file, registers the card type via `registerFromUpload`-like logic, and loads the data. Add export/import buttons to the sidebar.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-065] Add search/filter in card view
- **Priority:** P2
- **What:** Add a search bar above the card grid that filters visible cards by matching any field value (same behavior as table view's global filter).
- **Why:** With 50+ cards, scrolling the grid to find a specific card is tedious. Table view has search but card view doesn't.
- **Preserves:** Card grid rendering. Cards are hidden/shown, not removed from data.
- **Approach:** Add a search input above `#card-grid`. On input (debounced), add a `.hidden` class to card pairs whose data rows don't match the query. Reuse the same matching logic as `rebuildTbody()`'s global filter.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

---

### 8. Performance

#### [REQ-070] Add template compilation/caching
- **Priority:** P1
- **What:** Pre-compile templates into reusable render functions instead of re-running regex replacements on every `renderTemplate()` call. Cache compiled functions by template string.
- **Why:** `renderTemplate()` runs 6+ regex replacements per card per render. For 200 cards, that's 1,200+ regex operations. Compilation converts the template into a function that does direct string concatenation.
- **Preserves:** Identical output for all template syntax. `renderTemplate()` API unchanged.
- **Approach:** Add a `compileTemplate(templateStr)` function that parses the template once into an AST (array of segments: literal strings, variable references, sections, inverted sections, icons, QR). Returns a `render(data)` function that walks the AST. Cache compiled templates in a `Map<string, Function>`. `renderTemplate()` checks cache first.
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-011 (tests must exist first)

#### [REQ-071] Virtual scrolling for large card grids
- **Priority:** P2
- **What:** For decks with 100+ cards, implement virtual scrolling in card view to only render visible cards.
- **Why:** With 200+ cards, the DOM has 400+ card wrappers. This causes jank on scroll and high memory usage. The print layout (REQ-072) is a separate concern.
- **Preserves:** Card rendering quality. Edit button interaction. Show/hide backs toggle.
- **Approach:** Use intersection observer or scroll-position-based rendering. Given that cards have fixed dimensions (set by `cardSize`), calculate visible range from scroll position. Render a container with `height = totalCards * cardHeight`, position a smaller window of actual card DOM nodes. Consider using a library like `virtual-scroller` for the heavy lifting, or implement a simple version given the fixed card sizes.
- **Estimated Scope:** L (days)
- **Dependencies:** None

#### [REQ-072] Optimize print layout for large decks
- **Priority:** P2
- **What:** The print layout renders ALL cards into the DOM at once (front pages + back pages). For 200 cards, that's 400+ card renders plus 44+ pages of DOM. Optimize by generating print pages lazily or using a chunked approach.
- **Why:** Large decks may cause the browser to hang during print layout generation.
- **Preserves:** Print output quality: 3x3 grid, cut marks, mirrored backs.
- **Approach:** Profile first to determine if this is actually a bottleneck. If so, generate pages in batches using `requestAnimationFrame` to avoid blocking the main thread. Show a progress indicator.
- **Estimated Scope:** M (day)
- **Dependencies:** None

---

### 9. Security & Robustness

#### [REQ-080] Document XSS trade-offs in triple-brace rendering
- **Priority:** P0
- **What:** Document in README and card type authoring guide that `{{{field}}}` renders unescaped HTML. Explain the security model: users are rendering their own data, so XSS is a self-XSS scenario (not a risk in the typical threat model for a local-first tool). Add a prominent note for anyone embedding Card Maker in a multi-user context.
- **Why:** Open-source projects must be transparent about security trade-offs. Users deploying this in shared environments need to understand the risk.
- **Preserves:** Existing rendering behavior. Triple-brace raw output is a core feature, not a bug.
- **Approach:** Add a "Security Considerations" section to README and to the card type authoring guide. Explain: `{{field}}` is always safe (HTML-escaped), `{{{field}}}` is for trusted data (e.g., custom HTML formatting in card content), `{{{icon:field}}}` and `{{{qr:field}}}` are safe (generated HTML).
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-030

#### [REQ-081] Validate and sanitize custom card type uploads
- **Priority:** P1
- **What:** Strengthen validation in `registerFromUpload()`: (1) validate JSON schema structure more thoroughly (check field property types, not just existence), (2) sanitize CSS to prevent `@import` and `url()` calls to external resources, (3) warn about `<script>` tags in templates.
- **Why:** Custom card type uploads are a user-controlled injection point. While the threat model is self-XSS, basic validation prevents accidental breakage.
- **Preserves:** All valid card type uploads continue to work. Validation is additive (new checks), not restrictive on existing valid inputs.
- **Approach:** In `registerFromUpload()`: add type checks for field properties (`typeof field.key === 'string'`, `Array.isArray(field.options)` when present). For CSS: strip `@import` rules and `url()` references to external domains (allow `data:` URLs). For templates: console.warn if `<script>` tags are detected but don't block (user may have legitimate reasons).
- **Estimated Scope:** M (day)
- **Dependencies:** REQ-014

#### [REQ-082] Add Content Security Policy
- **Priority:** P2
- **What:** Add a CSP meta tag to `index.html` that allows: `script-src 'self'` (ES modules), `style-src 'self' 'unsafe-inline'` (card type CSS injection requires unsafe-inline), `img-src 'self' https://game-icons.net data:` (icon loading), `connect-src 'self' https://game-icons.net` (fetch for icons).
- **Why:** CSP is defense-in-depth against XSS even in a self-XSS context. It limits the damage of any injected script.
- **Preserves:** All existing functionality (icon loading, inline styles from card types).
- **Approach:** Add `<meta http-equiv="Content-Security-Policy" content="...">` to `index.html`. Test thoroughly — CSP violations cause silent failures.
- **Estimated Scope:** S (hours)
- **Dependencies:** None

---

### 10. Deployment & Distribution

#### [REQ-045] GitHub Pages deployment via CI
- **Priority:** P0
- **What:** Add a GitHub Actions workflow that deploys to GitHub Pages on push to `main`. If using Vite build (REQ-004), deploy the `dist/` folder. Otherwise, deploy the root directory.
- **Why:** A live demo is critical for open-source adoption. Users need to try the app before cloning the repo.
- **Preserves:** No application changes.
- **Approach:** Use `actions/deploy-pages@v4`. If using Vite, run `npm run build` first and deploy `dist/`. Add a "Live Demo" link to README.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-006

#### [REQ-046] Add PWA support
- **Priority:** P2
- **What:** Add a web app manifest and service worker for offline capability and "Add to Home Screen" support.
- **Why:** Card Maker is a perfect PWA candidate — it's fully client-side with no backend. Offline support means users can use it on planes, at game tables without WiFi, etc.
- **Preserves:** All existing functionality. PWA is additive.
- **Approach:** Create `manifest.json` with app name, icons, theme color, display: standalone. Create a basic service worker that caches the app shell (HTML, CSS, JS, card type files). Use a cache-first strategy for app assets, network-first for game-icons.net requests. Register the service worker in `app.js`.
- **Estimated Scope:** M (day)
- **Dependencies:** None

#### [REQ-047] Establish versioning strategy
- **Priority:** P1
- **What:** Adopt SemVer. Tag the initial release as v1.0.0. Add version to package.json, README, and app header.
- **Why:** Versions communicate stability and breaking changes to users.
- **Preserves:** N/A.
- **Approach:** SemVer with the following policy: breaking changes to schema format or template syntax are major versions. New features are minor. Bug fixes are patches. Create the first GitHub Release with a tag.
- **Estimated Scope:** S (hours)
- **Dependencies:** REQ-001, REQ-034

---

## Implementation Order

### Phase 1: Foundation (Weeks 1-2)
*Goal: Make the project cloneable, testable, and contributable. Ship as v1.0.0.*

1. **REQ-033** — Add LICENSE file
2. **REQ-001** — Initialize package.json
3. **REQ-002** — Add .gitignore and .editorconfig
4. **REQ-003** — Dev server with live reload
5. **REQ-005** — ESLint and Prettier
6. **REQ-010** — Test framework setup
7. **REQ-011** — Template renderer tests
8. **REQ-012** — CSV parser tests
9. **REQ-013** — QR code tests
10. **REQ-014** — Card type registry tests
11. **REQ-006** — GitHub Actions CI
12. **REQ-030** — README rewrite
13. **REQ-080** — Document XSS trade-offs
14. **REQ-031** — CONTRIBUTING.md
15. **REQ-034** — CHANGELOG setup
16. **REQ-045** — GitHub Pages deployment
17. **REQ-047** — Versioning strategy (tag v1.0.0)

### Phase 2: Quality & Trust (Weeks 3-4)
*Goal: Accessibility, code quality, security. Ship as v1.1.0.*

18. **REQ-015** — Integration tests
19. **REQ-016** — Coverage targets
20. **REQ-023** — Error handling audit
21. **REQ-056** — Malformed CSV diagnostics
22. **REQ-024** — Module dependency graph cleanup (state.js)
23. **REQ-020** — JSDoc type annotations
24. **REQ-040** — ARIA attributes
25. **REQ-041** — Focus trapping in modal
26. **REQ-043** — Color contrast audit
27. **REQ-044** — Skip navigation link
28. **REQ-081** — Validate custom card type uploads
29. **REQ-082** — Content Security Policy
30. **REQ-032** — Card type authoring guide

### Phase 3: Polish (Weeks 5-6)
*Goal: UX improvements that make the app feel professional. Ship as v1.2.0.*

31. **REQ-050** — Drag-and-drop CSV upload
32. **REQ-051** — Loading states for icon preload
33. **REQ-052** — Improved empty state / onboarding
34. **REQ-060** — Add new card from card view
35. **REQ-065** — Search in card view
36. **REQ-070** — Template compilation/caching
37. **REQ-042** — Keyboard navigation for table view
38. **REQ-053** — Keyboard shortcuts
39. **REQ-004** — Vite build configuration
40. **REQ-021** — Decompose table-view.js

### Phase 4: Features (Weeks 7+)
*Goal: New capabilities that expand the app's value. Ship as v1.3.0+.*

41. **REQ-022** — Decompose ui.js
42. **REQ-054** — Dark mode
43. **REQ-055** — Undo/redo
44. **REQ-061** — Duplicate card
45. **REQ-062** — Persistent storage (IndexedDB)
46. **REQ-063** — Export as PNG
47. **REQ-064** — Import/export deck state
48. **REQ-046** — PWA support
49. **REQ-071** — Virtual scrolling
50. **REQ-072** — Print layout optimization

---

## Risk Register

### R1: PapaParse vendored vs. npm dependency
- **Risk:** PapaParse is loaded via `<script>` tag as a global (`Papa`). Moving to `import` requires either a build step or converting to ES module.
- **Mitigation:** Keep the vendored copy for Phase 1-2. In Phase 3, if Vite is adopted (REQ-004), switch to `import Papa from 'papaparse'` in csv-parser.js and let Vite handle the bundling. Until then, configure ESLint to recognize `Papa` as a global.

### R2: Module decomposition breaking imports
- **Risk:** REQ-021 (table-view split) and REQ-022 (ui.js split) change internal module structure. Any file importing from `table-view.js` or `ui.js` could break.
- **Mitigation:** Use the re-export pattern — the original module files continue to exist and re-export everything from sub-modules. No external import paths change. Integration tests (REQ-015) must pass before and after decomposition.

### R3: CSS custom property dark mode conflicts with card type CSS
- **Risk:** Card type CSS (e.g., plant-care, ttrpg styles) may use hardcoded colors that look wrong in dark mode.
- **Mitigation:** Dark mode (REQ-054) should only change the app chrome (header, sidebar, table, backgrounds). Card rendering areas (`card-wrapper`) keep their white background as a "paper" metaphor. Document this for card type authors: cards render on a white background regardless of theme.

### R4: Icon loading changes breaking card rendering
- **Risk:** Any changes to icon-loader.js could break the rendering pipeline since icons are fetched at render time.
- **Mitigation:** The current approach (URL-based `<img>` tags rather than inline SVG injection) is robust — the renderer just generates URLs. Icon preloading is an optimization, not a correctness requirement. Template renderer tests (REQ-011) should mock icon URLs and verify the generated HTML structure.

### R5: File System Access API deprecation or spec changes
- **Risk:** The File System Access API is a Chromium-only API that may change.
- **Mitigation:** The app already has a fallback path for non-Chromium browsers (file download). The FSAPI code is isolated in `ui.js` (now `file-io.js` after REQ-022). Monitor the spec status.

### R6: Test environment DOM fidelity
- **Risk:** JSDOM does not perfectly replicate browser behavior. Integration tests (REQ-015) may pass in JSDOM but fail in real browsers, or vice versa.
- **Mitigation:** Keep integration tests focused on data flow (does the data render correctly?) rather than visual rendering. Use the live app + manual testing for visual verification. Consider adding Playwright for critical end-to-end flows if JSDOM proves insufficient.

### R7: Breaking existing card types
- **Risk:** Changes to `template-renderer.js`, `card-type-registry.js`, or CSS could break the plant-care and ttrpg card types.
- **Mitigation:** Template renderer tests (REQ-011) use the actual card type templates as test fixtures. CI runs these tests. Card type files in `card-types/` are never modified. The schema format is additive-only (new optional properties, never removing existing ones).

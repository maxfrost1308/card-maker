# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

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

[1.0.0]: https://github.com/your-username/card-maker/releases/tag/v1.0.0

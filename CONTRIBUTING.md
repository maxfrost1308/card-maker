# Contributing to Card Maker

Thanks for your interest! Here's everything you need to get productive.

---

## Development Setup

```bash
git clone https://github.com/your-username/card-maker.git
cd card-maker
npm install
npm start        # starts Vite dev server at http://localhost:5173
```

The app works directly as a static site — no build step required for development. Changes to HTML, CSS, and JS are reflected immediately via Vite's HMR.

---

## Project Structure

```
card-maker/
├── index.html              # App shell (single page)
├── js/
│   ├── app.js              # Entry point: registers card types, binds events
│   ├── card-type-registry.js  # Stores and validates card type definitions
│   ├── csv-parser.js       # PapaParse wrapper + header remapping
│   ├── edit-view.js        # Edit modal: field forms, pill pickers, verification
│   ├── icon-loader.js      # game-icons.net URL resolution + preloading
│   ├── print-layout.js     # Print layout generation (3×3 grid, cut marks)
│   ├── qr-code.js          # Self-contained QR code SVG generator
│   ├── starter-files.js    # Download helpers for card type starter files
│   ├── table-view.js       # Table view: rendering, inline editing, filters, sort
│   ├── template-renderer.js  # Mustache-like template engine
│   └── ui.js               # Main UI orchestration: views, sidebar, file I/O
├── css/
│   ├── app.css             # Core layout and shared component styles
│   ├── edit-view.css       # Edit modal styles
│   ├── print.css           # Print layout styles
│   └── table-view.css      # Table view styles
├── card-types/
│   ├── plant-care/         # Built-in: Plant Care card type
│   └── ttrpg/              # Built-in: TTRPG card type
├── lib/
│   └── papaparse.min.js    # Vendored PapaParse (loaded via <script> tag)
└── tests/
    ├── unit/               # Unit tests for pure logic modules
    └── integration/        # Integration tests for composed workflows
```

---

## Code Style

The project uses **ESLint** and **Prettier**. Run them before committing:

```bash
npm run lint       # check for issues
npm run format     # auto-format all JS/CSS/HTML
```

Key conventions:
- 2-space indentation, LF line endings
- Single quotes for strings
- `const` / `let`, no `var`
- ES modules (`import` / `export`), no CommonJS

---

## Running Tests

```bash
npm test              # run all tests once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
```

Tests live in `tests/unit/` and use [Vitest](https://vitest.dev/) with a JSDOM environment.

---

## How the Card Type System Works

A card type is a bundle of four things:

1. **Schema (`card-type.json`)** — defines the card's fields, size, and optional color mappings
2. **Front template (`front.html`)** — Mustache-like HTML template for the card face
3. **Back template (`back.html`)** — optional template for the card back
4. **Styles (`style.css`)** — CSS scoped to `[data-card-type="your-id"]`

The registry (`card-type-registry.js`) loads and stores these. The template renderer (`template-renderer.js`) turns a row of CSV data + a template into rendered HTML.

See [docs/card-type-authoring.md](docs/card-type-authoring.md) for the complete guide.

---

## Adding a New Built-in Card Type

1. Create a directory under `card-types/your-id/`
2. Add `card-type.json`, `front.html`, `back.html` (optional), `style.css`, and `sample-data.json`
3. Register it in `js/app.js`:
   ```js
   await registerBuiltIn('your-id');
   ```
4. Call `autoSelect('your-id')` if it should be the default

---

## PR Process

1. Fork the repo and create a branch: `git checkout -b feat/your-feature`
2. Make your changes, add/update tests as needed
3. Ensure lint and tests pass: `npm run lint && npm test`
4. Open a PR against `main` with a clear description of what changed and why
5. Link any related issues

---

## Versioning

This project follows [SemVer](https://semver.org/):
- **Major** — breaking changes to schema format or template syntax
- **Minor** — new features, backwards-compatible
- **Patch** — bug fixes

Update `CHANGELOG.md` in your PR.

# Card Maker

Design, edit, and print custom cards from CSV data — entirely in the browser, no server required.

[![CI](https://github.com/your-username/card-maker/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/card-maker/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

![Card Maker screenshot](docs/screenshot.png)

**[Live Demo](https://your-username.github.io/card-maker)** · [Docs](docs/) · [Contributing](CONTRIBUTING.md)

---

## Features

- **CSV-driven** — load any spreadsheet and render it as a card deck instantly
- **Two built-in card types** — Plant Care labels and TTRPG monster/item cards
- **Custom card types** — upload your own schema, templates (Mustache-like syntax), and CSS
- **Table view** — edit data inline with filtering, sorting, and tag autocomplete
- **Edit modal** — rich per-card editor with pill pickers and verified-field tracking
- **Print-ready** — generates a 3×3 print layout with cut marks and mirrored backs
- **QR codes** — auto-generate QR codes from URL fields
- **Icon support** — integrates with [game-icons.net](https://game-icons.net) for TTRPG icons
- **Zero dependencies at runtime** — vanilla JS, ES modules, no build step required

---

## Quick Start

```bash
git clone https://github.com/your-username/card-maker.git
cd card-maker
npm install
npm start
```

Then open [http://localhost:5173](http://localhost:5173) in your browser.

> **No npm?** The app also works directly from any static file server. Just serve the project root over HTTP (ES modules require HTTP, not `file://`).

---

## Usage

1. **Select a card type** from the left sidebar (Plant Care or TTRPG to start)
2. **Load a CSV** using the "Open CSV" button — the app auto-maps column headers to fields
3. **Edit cards** by clicking the edit icon on any card, or switch to Table view for bulk editing
4. **Print** using the "Print / PDF" button — generates a printer-ready layout

### Saving

- **Save (Ctrl+S)** — writes back to the original file (Chromium only, via File System Access API)
- **Download** — saves a new copy as a `.csv` file (all browsers)

---

## Built-in Card Types

### 🌱 Plant Care
Printable care labels for houseplants. Fields: name, species, light, water, humidity, notes, and more. Great for labelling a collection or gifting plants.

### ⚔️ TTRPG
Monster and item cards for tabletop RPGs. Supports icons from game-icons.net, stat blocks, tags, rarity colors, and QR codes for rules references.

---

## Custom Card Types

You can create your own card types by uploading four files:

| File | Purpose |
|---|---|
| `card-type.json` | Schema: fields, card size, color mappings |
| `front.html` | Mustache-like template for the card front |
| `back.html` | (Optional) Template for the card back |
| `style.css` | Scoped CSS (use `[data-card-type="your-id"]`) |

Use the "Upload Card Type" button in the sidebar, or see the full guide: [docs/card-type-authoring.md](docs/card-type-authoring.md).

---

## Template Syntax

Card templates use a Mustache-like syntax:

| Syntax | Effect |
|---|---|
| `{{field}}` | HTML-escaped value substitution |
| `{{{field}}}` | Raw (unescaped) value substitution |
| `{{#field}}...{{/field}}` | Conditional block (truthy) or array iteration |
| `{{^field}}...{{/field}}` | Inverted block (renders when field is empty/falsy) |
| `{{.}}` | Current item inside an array iteration |
| `{{@index}}` | Zero-based index inside an array iteration |
| `{{{icon:field}}}` | Inline icon from game-icons.net |
| `{{{qr:field}}}` | Inline QR code SVG from field value |

---

## Tech Stack

- **Vanilla JavaScript** — ES modules, no framework
- **[PapaParse](https://www.papaparse.com/)** — CSV parsing
- **[Vite](https://vitejs.dev/)** — dev server and optional build (dev only)
- **[Vitest](https://vitest.dev/)** — testing (dev only)

---

## Security Considerations

Card Maker is a **local-first tool** — you control all the data it processes.

- `{{field}}` substitution always HTML-escapes output — safe for any value.
- `{{{field}}}` renders raw HTML — intended for trusted card type templates where you control the content. In a personal workflow, this is not a risk.
- Custom card type uploads inject CSS and HTML templates into the DOM. Only upload card types from sources you trust.

> **Multi-user deployments:** If you embed Card Maker in a shared environment where users can upload card types or load CSVs from untrusted sources, the raw `{{{field}}}` syntax and custom CSS uploads are potential XSS vectors. Consider adding server-side sanitization or disabling those features.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup instructions, project structure, and the PR process.

---

## License

MIT — see [LICENSE](LICENSE).

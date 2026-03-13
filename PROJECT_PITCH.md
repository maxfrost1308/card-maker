# Card Maker — Turn Any Spreadsheet Into Beautiful Printable Cards

## The Problem

People organize information in spreadsheets all the time — game collections, plant care notes, recipe ingredients, study flashcards. But spreadsheets are ugly, hard to browse, and terrible to print. Existing card-design tools either lock you into rigid templates, require design skills, or need accounts and subscriptions just to export a PDF.

## The Solution

**Card Maker** is a free, browser-based tool that turns CSV data into fully customizable, print-ready cards — no accounts, no installs, no backend.

1. **Upload a CSV** with your data.
2. **Pick a card type** (or design your own).
3. **Browse, edit, and filter** your cards in a visual grid or sortable table.
4. **Print** a perfectly laid-out 3×3 sheet with cutting guides, ready for sleeving.

Everything runs locally in the browser. Your data never leaves your machine.

## Key Features

- **Zero setup** — Open a single HTML file and start making cards.
- **Flexible template engine** — Mustache-style templates with conditionals, loops, icon embedding, and QR code generation built in.
- **Bring your own card type** — Define a JSON schema, drop in an HTML template and CSS, and Card Maker handles the rest. Any domain, any layout.
- **Rich data table** — Sort, filter, bulk-select, and inline-edit without leaving the app.
- **Print-optimized output** — Poker-size cards (63.5 × 88.9 mm) on US Letter with precise cutting guides. Customize card dimensions per type.
- **Works offline** — No network required after the initial page load (icons are the one optional exception).

## Built-in Card Types

| Type | Use Case |
|------|----------|
| **TTRPG Collection** | Track board and tabletop games with complexity, player count, genre, mechanics, and ownership status. |
| **Plant Care** | Quick-reference cards for houseplants — light, water, humidity, soil, toxicity, and propagation info. |

Creating a new card type takes minutes: a JSON schema for your fields, an HTML template for the front and back, and optional CSS.

## Tech Stack

- **Vanilla JavaScript (ES6 modules)** — no framework, no build step, no node_modules.
- **Papa Parse** for CSV handling.
- **Self-contained QR code generator** — no external library needed.
- **Pure CSS** with variables, flexbox, and grid for a responsive, mobile-friendly UI.

## Who Is This For?

- **Tabletop gamers** who want reference cards for their collection.
- **Plant parents** who keep care sheets for every pot on the shelf.
- **Educators** building flashcard sets from class data.
- **Game designers** prototyping card decks from a spreadsheet.
- **Anyone** who thinks their data would look better as a stack of cards than a wall of cells.

## Why It Matters

Card Maker sits at the intersection of data management and physical crafting. It respects users by running entirely client-side, requiring no sign-up, and producing output you can hold in your hands. It's the kind of tool that turns a rainy afternoon and a spreadsheet into something you're proud to sleeve up and put on a shelf.

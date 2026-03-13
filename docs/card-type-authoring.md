# Card Type Authoring Guide

Card Maker is extensible. You can create any card layout by providing four files:

| File | Required | Purpose |
|------|----------|---------|
| `card-type.json` | ✅ | Schema: fields, card size, color mappings |
| `front.html` | ✅ | Mustache-like template for the card front |
| `back.html` | ❌ | Template for the card back (optional) |
| `style.css` | ❌ | Scoped styles for your card |

Upload all four using the "Upload Custom Card Type" section in the sidebar.

---

## The Schema File (`card-type.json`)

```json
{
  "id": "my-card-type",
  "name": "My Card Type",
  "description": "A short description shown in the sidebar.",
  "cardSize": { "width": "63.5mm", "height": "88.9mm" },
  "fields": [
    { "key": "name",   "label": "Name",  "type": "text",   "required": true },
    { "key": "rarity", "label": "Rarity","type": "select", "options": ["common","rare","epic"] }
  ],
  "colorMapping": {
    "bg_color": {
      "field": "rarity",
      "map": { "common": "#aaaaaa", "rare": "#4488ff", "epic": "#aa44ff" },
      "default": "#ffffff"
    }
  }
}
```

### Top-Level Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `id` | string | ✅ | Unique identifier (URL-safe, e.g. `"my-deck"`) |
| `name` | string | ✅ | Display name shown in the card type dropdown |
| `description` | string | ❌ | Short description shown in the sidebar |
| `cardSize` | `{ width, height }` | ❌ | CSS dimensions (default: `63.5mm × 88.9mm`, standard poker card) |
| `fields` | Field[] | ✅ | Array of field definitions (see below) |
| `colorMapping` | object | ❌ | Derive field values from other fields (see below) |
| `aggregations` | object | ❌ | Summary stats shown below the table (see below) |

---

## Field Definition

```json
{
  "key": "difficulty",
  "label": "Difficulty",
  "type": "select",
  "options": ["easy", "medium", "hard"],
  "pillColors": { "easy": "#4caf50", "medium": "#ff9800", "hard": "#f44336" },
  "required": false,
  "hidden": false,
  "verifiable": true,
  "separator": "|",
  "maxLength": 120
}
```

### Field Properties

| Property | Type | Required | Description |
|----------|------|----------|-------------|
| `key` | string | ✅ | Internal identifier — used as the CSV column name and template variable |
| `label` | string | ❌ | Display label in the editor (defaults to `key`) |
| `type` | string | ✅ | Field type — see table below |
| `options` | string[] | for `select`/`multi-select` | List of allowed values |
| `pillColors` | object | ❌ | `{ value: color }` map for pill background colors |
| `separator` | string | ❌ | Delimiter for `multi-select`/`tags` (default: `\|`) |
| `maxLength` | number | ❌ | Character limit for text inputs |
| `required` | boolean | ❌ | Marks field as required (shown with `*` in editor) |
| `hidden` | boolean | ❌ | Hide from editor (preserved in CSV, e.g. internal IDs) |
| `verifiable` | boolean | ❌ | Show a verify checkbox in the editor |

### Field Types

| Type | Description | Editor Widget |
|------|-------------|--------------|
| `text` | Plain text | `<input type="text">` |
| `number` | Numeric value | `<input type="number">` |
| `url` | URL | `<input type="url">` |
| `image` | Image URL | `<input type="text">` |
| `select` | Single value from options | Pill picker (single-select) |
| `multi-select` | Multiple values from options | Pill picker (multi-select) |
| `tags` | Free-form tags with autocomplete | Tag picker |
| `icon` | game-icons.net icon slug | `<input type="text">` |
| `qr` | URL/text → QR code SVG | `<input type="text">` |

---

## Template Syntax

Templates use a Mustache-like syntax. Use `{{field_key}}` to insert values.

### Basic Substitution

```html
<!-- HTML-escaped (safe for all values) -->
<h2>{{name}}</h2>

<!-- Raw HTML (use only for trusted content) -->
<div>{{{custom_html}}}</div>
```

### Conditional Blocks

```html
<!-- Render only when field has a value -->
{{#description}}
  <p class="desc">{{description}}</p>
{{/description}}

<!-- Render only when field is empty -->
{{^image_url}}
  <div class="placeholder-art"></div>
{{/image_url}}
```

### Array Iteration (`multi-select` / `tags`)

```html
<!-- {{.}} = current item, {{@index}} = zero-based index -->
<ul class="tags">
  {{#tags}}<li class="tag">{{.}}</li>{{/tags}}
</ul>
```

### `_lower` CSS Class Variants

Every field automatically gets a `field_lower` variant: the value lowercased with spaces replaced by `-`. Useful for CSS class hooks:

```html
<!-- If rarity = "Ultra Rare", rarity_lower = "ultra-rare" -->
<div class="card rarity-{{rarity_lower}}">...</div>
```

### Icons (game-icons.net)

```html
{{{icon:icon_field}}}
<!-- Renders: <img src="https://game-icons.net/icons/..." class="icon-img" alt="icon"> -->
```

The `icon` field type stores slug names like `"dragon-head"` or `"sword"`.
Browse available icons at [game-icons.net](https://game-icons.net).

### QR Codes

```html
{{{qr:url_field}}}
<!-- Renders an inline SVG QR code from the field's URL/text value -->
```

---

## CSS Scoping

Your styles should be scoped to `[data-card-type="your-id"]` to avoid affecting other card types:

```css
[data-card-type="my-card-type"] {
  font-family: 'Georgia', serif;
  background: #1a1a2e;
  color: #e8d8a0;
}

[data-card-type="my-card-type"] .card-title {
  font-size: 14px;
  font-weight: bold;
  text-align: center;
}
```

### Card Size in CSS

To set the base font size relative to card dimensions (useful for mm-based cards):

```css
[data-card-type="my-card-type"] {
  /* 63.5mm wide = ~240px at 96dpi; scale fonts accordingly */
  font-size: 10px;
}
```

---

## Color Mapping

`colorMapping` lets you derive one field's value from another. The most common use case: automatically set a background color based on a `rarity` or `type` field.

```json
"colorMapping": {
  "bg_color": {
    "field": "rarity",
    "map": {
      "common":    "#8c8c8c",
      "uncommon":  "#4caf50",
      "rare":      "#2196f3",
      "epic":      "#9c27b0",
      "legendary": "#ff9800"
    },
    "default": "#ffffff"
  }
}
```

- `bg_color` is the **target field** — it will be created automatically from the mapping.
- If a row already has a value for `bg_color`, the mapping is skipped for that row.
- Use the derived field in templates: `<div style="background: {{bg_color}}">...</div>`

---

## Aggregations

Show summary statistics below the table view:

```json
"aggregations": {
  "Total cards": { "type": "count" },
  "Avg difficulty": { "type": "avg", "field": "difficulty_score" },
  "By rarity": { "type": "countBy", "field": "rarity" }
}
```

| Type | Description |
|------|-------------|
| `count` | Total row count |
| `avg` | Average of a numeric field |
| `sum` | Sum of a numeric field |
| `countBy` | Count of each unique value in a field |

---

## Sample Data (`sample-data.json`)

Include sample data so users can preview your card type without loading a CSV:

```json
[
  { "name": "Fire Dragon", "rarity": "legendary", "tags": "fire|beast|dragon" },
  { "name": "Stone Golem",  "rarity": "common",    "tags": "earth|construct" }
]
```

---

## Step-by-Step Tutorial: Creating a Recipe Card

Here's a minimal worked example.

### 1. `card-type.json`

```json
{
  "id": "recipe-card",
  "name": "Recipe Card",
  "description": "Simple 4×6 recipe cards for cooking",
  "cardSize": { "width": "101.6mm", "height": "152.4mm" },
  "fields": [
    { "key": "title",       "label": "Recipe Title",  "type": "text",         "required": true },
    { "key": "category",    "label": "Category",      "type": "select",       "options": ["Breakfast","Lunch","Dinner","Dessert","Snack"] },
    { "key": "ingredients", "label": "Ingredients",   "type": "text" },
    { "key": "steps",       "label": "Instructions",  "type": "text" },
    { "key": "time",        "label": "Cook Time",     "type": "text" },
    { "key": "servings",    "label": "Servings",      "type": "number" }
  ]
}
```

### 2. `front.html`

```html
<div class="recipe-card">
  <div class="recipe-header">
    <h1 class="recipe-title">{{title}}</h1>
    {{#category}}<span class="recipe-category">{{category}}</span>{{/category}}
  </div>
  <div class="recipe-meta">
    {{#time}}<span>⏱ {{time}}</span>{{/time}}
    {{#servings}}<span>🍽 {{servings}} servings</span>{{/servings}}
  </div>
  <div class="recipe-section">
    <h2>Ingredients</h2>
    <p>{{ingredients}}</p>
  </div>
  <div class="recipe-section">
    <h2>Instructions</h2>
    <p>{{steps}}</p>
  </div>
</div>
```

### 3. `style.css`

```css
[data-card-type="recipe-card"] {
  font-family: Georgia, serif;
  padding: 8mm;
  background: #fffdf7;
  color: #2c1810;
  font-size: 9px;
}

[data-card-type="recipe-card"] .recipe-title {
  font-size: 1.4em;
  margin-bottom: 4px;
}

[data-card-type="recipe-card"] .recipe-category {
  font-size: 0.85em;
  color: #8b4513;
  font-style: italic;
}

[data-card-type="recipe-card"] h2 {
  font-size: 1em;
  border-bottom: 1px solid #c8a882;
  margin: 6px 0 3px;
}
```

### 4. Upload

1. Click "Register Card Type" in the sidebar
2. Select your four files
3. The card type appears in the dropdown immediately
4. Create a CSV with columns: `title, category, ingredients, steps, time, servings`
5. Load it and start editing!

---

## Tips

- **Font sizes**: Use `em` units so the card scales with the base `font-size` in your CSS
- **Card backs**: A simple back with your brand/logo makes the deck look professional
- **Hidden fields**: Use `"hidden": true` for internal fields (IDs, derived values) that shouldn't show in the editor but should be in the CSV
- **Test with sample data**: Add a `sample-data.json` and users see preview cards immediately after selecting your type
- **CSS variables**: You can define and use CSS custom properties within your scoped styles

---

## Security Note

- `{{field}}` is always HTML-escaped — safe for untrusted input
- `{{{field}}}` renders raw HTML — only use for content you control (e.g., your own template markup)
- Your CSS is sanitized on upload (external `@import` and `url()` references are stripped)
- Custom templates containing `<script>` tags will generate a console warning

/**
 * Starter Files module — downloadable sample files for custom card types.
 */

export function getStarterSchema() {
  return JSON.stringify(
    {
      id: 'my-cards',
      name: 'My Card Type',
      description: 'A custom card type — edit this to match your needs.',
      cardSize: { width: '2.5in', height: '3.5in' },
      fields: [
        { key: 'title', label: 'Title', type: 'text', required: true, maxLength: 60 },
        {
          key: 'category',
          label: 'Category',
          type: 'select',
          options: ['Option A', 'Option B', 'Option C'],
          pillColors: { 'Option A': '#27ae60', 'Option B': '#e67e22', 'Option C': '#c0392b' },
        },
        {
          key: 'tags',
          label: 'Tags',
          type: 'multi-select',
          separator: '|',
          options: ['Tag1', 'Tag2', 'Tag3', 'Tag4'],
          pillColors: { Tag1: '#2980b9', Tag2: '#8e44ad', Tag3: '#27ae60', Tag4: '#e67e22' },
        },
        { key: 'description', label: 'Description', type: 'text', maxLength: 200 },
        { key: 'count', label: 'Count', type: 'number' },
        { key: 'link', label: 'Link', type: 'url' },
        { key: 'icon', label: 'Icon', type: 'icon' },
      ],
    },
    null,
    2,
  );
}

export function getStarterFront() {
  return `<!-- Front template for "my-cards" card type -->
<!-- Available syntax: -->
<!--   {{field}}       — HTML-escaped value -->
<!--   {{{field}}}     — raw value (no escaping) -->
<!--   {{#field}}...{{/field}}  — section (truthy/array) -->
<!--   {{^field}}...{{/field}}  — inverted section (falsy/empty) -->
<!--   {{field_lower}}          — lowercase, hyphenated variant for CSS classes -->
<!--   {{{icon:field}}}        — inline SVG icon (game-icons.net or URL) -->
<!--   {{{qr:field}}}          — inline QR code SVG from field value -->

<div class="card-front" data-card-type="my-cards">
  <h2 class="card-title">{{title}}</h2>

  {{#category}}
  <p class="card-category category-{{category_lower}}">{{category}}</p>
  {{/category}}

  {{#tags}}
  <div class="card-tags">
    <span class="tag tag-{{._lower}}">{{.}}</span>
  </div>
  {{/tags}}

  {{#description}}
  <p class="card-desc">{{description}}</p>
  {{/description}}

  {{^description}}
  <p class="card-desc placeholder">No description provided.</p>
  {{/description}}

  {{#count}}
  <div class="card-count">x{{count}}</div>
  {{/count}}

  {{#link}}
  <a class="card-link" href="{{link}}">More info</a>
  {{/link}}
</div>
`;
}

export function getStarterBack() {
  return `<!-- Back template for "my-cards" card type -->
<div class="card-back" data-card-type="my-cards">
  <div class="back-content">
    <h3>{{title}}</h3>
    {{#category}}
    <p class="back-category">{{category}}</p>
    {{/category}}
  </div>
</div>
`;
}

export function getStarterCss() {
  return `/* Styles for "my-cards" card type.
   The [data-card-type="my-cards"] selector scopes styles
   to this card type only. Change "my-cards" to match your
   schema's "id" field. */

[data-card-type="my-cards"] .card-front {
  padding: 12px;
  font-family: system-ui, sans-serif;
  display: flex;
  flex-direction: column;
  height: 100%;
}

[data-card-type="my-cards"] .card-title {
  font-size: 1.1rem;
  margin-bottom: 8px;
  border-bottom: 2px solid #4a6fa5;
  padding-bottom: 4px;
}

[data-card-type="my-cards"] .card-category {
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #666;
  margin-bottom: 6px;
}

[data-card-type="my-cards"] .card-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-bottom: 8px;
}

[data-card-type="my-cards"] .tag {
  font-size: 0.65rem;
  background: #e8f0fe;
  color: #1a5276;
  padding: 2px 6px;
  border-radius: 3px;
}

[data-card-type="my-cards"] .card-desc {
  font-size: 0.8rem;
  flex: 1;
  line-height: 1.4;
}

[data-card-type="my-cards"] .card-desc.placeholder {
  color: #aaa;
  font-style: italic;
}

[data-card-type="my-cards"] .card-count {
  font-size: 1.5rem;
  font-weight: 700;
  text-align: right;
  color: #4a6fa5;
}

[data-card-type="my-cards"] .card-link {
  font-size: 0.7rem;
  color: #4a6fa5;
  text-decoration: none;
}

[data-card-type="my-cards"] .card-back {
  padding: 12px;
  font-family: system-ui, sans-serif;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  background: #f0f4f8;
}

[data-card-type="my-cards"] .back-content {
  text-align: center;
}

[data-card-type="my-cards"] .back-category {
  font-size: 0.8rem;
  color: #666;
}
`;
}

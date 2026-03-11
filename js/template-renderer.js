/**
 * Minimal Mustache-like template renderer for card templates.
 *
 * Supported syntax:
 *   {{field}}                        — value substitution (HTML-escaped)
 *   {{{field}}}                      — raw value substitution (no escaping)
 *   {{#field}}...{{.}}...{{/field}}  — iterate over array (multi-select fields)
 *   {{#field}}...{{/field}}          — conditional block (truthy non-array fields)
 *   {{^field}}...{{/field}}          — inverted block (falsy/empty fields)
 */

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

/**
 * Preprocess a CSV row object using the card type schema.
 * - Multi-select fields are split into arrays.
 * - Adds lowercased variants (field_lower) for CSS class hooks.
 */
export function preprocessRow(row, fields) {
  const data = {};
  for (const field of fields) {
    let val = row[field.key];
    if (val === undefined || val === null) val = '';
    if (typeof val === 'string') val = val.trim();

    if (field.type === 'multi-select' && typeof val === 'string' && val.length > 0) {
      const sep = field.separator || '|';
      data[field.key] = val.split(sep).map(v => v.trim()).filter(Boolean);
    } else {
      data[field.key] = val;
    }

    // Lowercased variant for CSS class usage
    if (typeof data[field.key] === 'string') {
      data[field.key + '_lower'] = data[field.key].toLowerCase().replace(/\s+/g, '-');
    } else if (Array.isArray(data[field.key])) {
      data[field.key + '_lower'] = data[field.key].map(v => v.toLowerCase().replace(/\s+/g, '-'));
    }
  }
  // Also carry forward any fields not in schema (extra CSV columns)
  for (const key of Object.keys(row)) {
    if (!(key in data)) {
      data[key] = row[key];
      if (typeof row[key] === 'string') {
        data[key + '_lower'] = row[key].toLowerCase().replace(/\s+/g, '-');
      }
    }
  }
  return data;
}

/**
 * Render a template string with the given data object.
 */
export function renderTemplate(template, data) {
  let html = template;

  // 1. Inverted blocks: {{^field}}...{{/field}}
  html = html.replace(/\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
    const val = data[key];
    const isEmpty = val === undefined || val === null || val === '' ||
                    (Array.isArray(val) && val.length === 0);
    return isEmpty ? inner : '';
  });

  // 2. Section blocks: {{#field}}...{{/field}}
  html = html.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, inner) => {
    const val = data[key];
    if (Array.isArray(val)) {
      if (val.length === 0) return '';
      return val.map((item, i) => {
        let out = inner;
        // {{.}} = the value, {{@index}} = index
        out = out.replace(/\{\{\.\}\}/g, escapeHtml(item));
        out = out.replace(/\{\{@index\}\}/g, String(i));
        // Also allow {{{.}}} for raw
        out = out.replace(/\{\{\{\.\}\}\}/g, String(item));
        return out;
      }).join('');
    }
    // Truthy check for non-array
    if (val && val !== '') return inner.replace(/\{\{\.\}\}/g, escapeHtml(String(val)));
    return '';
  });

  // 3. Raw substitution: {{{field}}}
  html = html.replace(/\{\{\{(\w+)\}\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });

  // 4. Escaped substitution: {{field}}
  html = html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = data[key];
    if (val === undefined || val === null) return '';
    if (Array.isArray(val)) return escapeHtml(val.join(', '));
    return escapeHtml(String(val));
  });

  return html;
}

/**
 * Full card render pipeline: preprocess + render.
 */
export function renderCard(template, row, fields) {
  const data = preprocessRow(row, fields);
  return renderTemplate(template, data);
}

/**
 * Minimal Mustache-like template renderer for card templates.
 *
 * Supported syntax:
 *   {{field}}                        — value substitution (HTML-escaped)
 *   {{{field}}}                      — raw value substitution (no escaping)
 *   {{#field}}...{{.}}...{{/field}}  — iterate over array (multi-select fields)
 *   {{#field}}...{{/field}}          — conditional block (truthy non-array fields)
 *   {{^field}}...{{/field}}          — inverted block (falsy/empty fields)
 *   {{{icon:field}}}                 — inline SVG icon from cached icon data
 *   {{{qr:field}}}                   — inline QR code SVG from field value
 */

import { resolveIconUrl } from './icon-loader.js';
import { generateQrSvg } from './qr-code.js';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ESC_MAP[c]);
}

/**
 * Preprocess a CSV row object using the card type schema.
 * - Multi-select / tags fields are split into arrays.
 * - Adds lowercased variants (field_lower) for CSS class hooks.
 * - Applies colorMapping from the card type to derive field values.
 */
export function preprocessRow(row, fields, cardType) {
  const data = {};
  for (const field of fields) {
    let val = row[field.key];
    if (val === undefined || val === null) val = '';
    if (typeof val === 'string') val = val.trim();

    if ((field.type === 'multi-select' || field.type === 'tags') && typeof val === 'string' && val.length > 0) {
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

  // Apply colorMapping from card type schema
  if (cardType && cardType.colorMapping) {
    for (const [targetField, mapping] of Object.entries(cardType.colorMapping)) {
      // Only derive if the target field is empty/missing in this row
      if (!data[targetField] || data[targetField] === '') {
        const sourceVal = data[mapping.field];
        const sourceStr = Array.isArray(sourceVal) ? sourceVal[0] : String(sourceVal || '');
        data[targetField] = mapping.map[sourceStr] || mapping.default || '';
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

  // 0a. Icon substitution: {{{icon:field}}}
  // Always use <img> tag with direct URL (avoids CORS issues with game-icons.net)
  html = html.replace(/\{\{\{icon:(\w+)\}\}\}/g, (_, key) => {
    const val = data[key];
    if (!val) return '';
    // Use black bg / white fg so mix-blend-mode: screen makes bg transparent
    const url = resolveIconUrl(String(val), 'ffffff', '000000');
    if (url) return `<img src="${escapeHtml(url)}" class="icon-img" data-icon="${escapeHtml(String(val))}" alt="icon">`;
    return '';
  });

  // 0b. QR code substitution: {{{qr:field}}}
  html = html.replace(/\{\{\{qr:(\w+)\}\}\}/g, (_, key) => {
    const val = data[key];
    if (!val) return '';
    return generateQrSvg(String(val));
  });

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
      // If inner template has no {{.}} placeholder, treat as truthy check (render once)
      if (!inner.includes('{{.}}') && !inner.includes('{{{.}}}')) {
        return inner;
      }
      return val.map((item, i) => {
        let out = inner;
        out = out.replace(/\{\{\.\}\}/g, escapeHtml(item));
        out = out.replace(/\{\{@index\}\}/g, String(i));
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
export function renderCard(template, row, fields, cardType) {
  const data = preprocessRow(row, fields, cardType);
  return renderTemplate(template, data);
}

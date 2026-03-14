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
 *
 * Performance: templates are compiled to segment-function arrays on first use
 * and cached by template string. Repeated renders of the same template
 * (e.g. 200 cards from one front.html) skip regex scanning entirely.
 */

import { resolveIconUrl } from './icon-loader.js';
import { generateQrSvg } from './qr-code.js';

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ESC_MAP[c]);
}

// ── Template compilation & caching (REQ-070) ──────────────────────────────────

/** @type {Map<string, function(Object): string>} */
const templateCache = new Map();

/**
 * Matches template tokens in the same order of precedence as the original
 * renderTemplate passes: icon, qr, section (#), inverted (^), raw ({}), escaped ({{}}).
 * Keys allow word chars, dots, and @ for {{.}} and {{@index}} inside sections.
 */
const TOKEN_RE =
  /\{\{\{icon:(\w+)\}\}\}|\{\{\{qr:(\w+)\}\}\}|\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\3\}\}|\{\{\^(\w+)\}\}([\s\S]*?)\{\{\/\5\}\}|\{\{\{([\w.@]+)\}\}\}|\{\{([\w.@]+)\}\}/g;

/**
 * Compile a template string into a cached render function.
 * The compiled function executes an array of segment functions, each
 * returning a string piece, avoiding repeated regex scanning.
 *
 * @param {string} templateStr
 * @returns {function(Object): string}
 */
export function compileTemplate(templateStr) {
  if (templateCache.has(templateStr)) return templateCache.get(templateStr);
  const segs = _buildSegments(templateStr);
  const fn = (data) => _exec(segs, data);
  templateCache.set(templateStr, fn);
  return fn;
}

/** @param {Array<function(Object):string>} segs */
function _exec(segs, data) {
  let out = '';
  for (const s of segs) out += s(data);
  return out;
}

/**
 * Parse a template string into an array of segment functions.
 * Each segment takes a data object and returns a string fragment.
 * Sections are parsed recursively.
 *
 * @param {string} template
 * @returns {Array<function(Object): string>}
 */
function _buildSegments(template) {
  const segs = [];
  // Use a fresh RegExp instance to avoid shared lastIndex state across recursive calls
  const re = new RegExp(TOKEN_RE.source, 'g');
  let last = 0;
  let m;

  while ((m = re.exec(template)) !== null) {
    // Literal text before this token
    if (m.index > last) {
      const lit = template.slice(last, m.index);
      segs.push(() => lit);
    }

    if (m[1] !== undefined) {
      // {{{icon:field}}}
      const key = m[1];
      segs.push((data) => {
        const val = data[key];
        if (!val) return '';
        const url = resolveIconUrl(String(val), 'ffffff', '000000');
        if (url)
          return `<img src="${escapeHtml(url)}" class="icon-img" data-icon="${escapeHtml(String(val))}" alt="icon">`;
        return '';
      });
    } else if (m[2] !== undefined) {
      // {{{qr:field}}}
      const key = m[2];
      segs.push((data) => {
        const val = data[key];
        if (!val) return '';
        return generateQrSvg(String(val));
      });
    } else if (m[3] !== undefined) {
      // {{#field}}...{{/field}} — array iteration or truthy check
      const key = m[3];
      const inner = m[4];
      const innerSegs = _buildSegments(inner); // recursive
      const hasPlaceholder = /\{\{[{]?\.\}?\}\}|\{\{@index\}\}/.test(inner);

      segs.push((data) => {
        const val = data[key];
        if (Array.isArray(val)) {
          if (val.length === 0) return '';
          if (!hasPlaceholder) return _exec(innerSegs, data);
          return val.map((item, i) => _exec(innerSegs, { ...data, '.': String(item), '@index': String(i) })).join('');
        }
        // Non-array truthy check
        if (val && val !== '') {
          return _exec(innerSegs, hasPlaceholder ? { ...data, '.': String(val) } : data);
        }
        return '';
      });
    } else if (m[5] !== undefined) {
      // {{^field}}...{{/field}} — inverted block
      const key = m[5];
      const innerSegs = _buildSegments(m[6]); // recursive
      segs.push((data) => {
        const val = data[key];
        const empty = val === undefined || val === null || val === '' || (Array.isArray(val) && val.length === 0);
        return empty ? _exec(innerSegs, data) : '';
      });
    } else if (m[7] !== undefined) {
      // {{{field}}} — raw (no escaping)
      const key = m[7];
      segs.push((data) => {
        const val = data[key];
        if (val === undefined || val === null) return '';
        return String(val);
      });
    } else if (m[8] !== undefined) {
      // {{field}} — escaped
      const key = m[8];
      segs.push((data) => {
        const val = data[key];
        if (val === undefined || val === null) return '';
        if (Array.isArray(val)) return escapeHtml(val.join(', '));
        return escapeHtml(String(val));
      });
    }

    last = re.lastIndex;
  }

  // Remaining literal text
  if (last < template.length) {
    const lit = template.slice(last);
    segs.push(() => lit);
  }

  return segs;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Preprocess a CSV row object using the card type schema.
 * - Multi-select / tags fields are split into arrays.
 * - Adds lowercased variants (field_lower) for CSS class hooks.
 * - Applies colorMapping from the card type to derive field values.
 *
 * @param {Object} row - Raw CSV row
 * @param {Object[]} fields - Schema field definitions
 * @param {Object|null} cardType - Card type (for colorMapping)
 * @returns {Object} Preprocessed data object
 */
export function preprocessRow(row, fields, cardType) {
  const data = {};
  for (const field of fields) {
    let val = row[field.key];
    if (val === undefined || val === null) val = '';
    if (typeof val === 'string') val = val.trim();

    if ((field.type === 'multi-select' || field.type === 'tags') && typeof val === 'string' && val.length > 0) {
      const sep = field.separator || '|';
      data[field.key] = val
        .split(sep)
        .map((v) => v.trim())
        .filter(Boolean);
    } else {
      data[field.key] = val;
    }

    // Lowercased variant for CSS class usage
    if (typeof data[field.key] === 'string') {
      data[field.key + '_lower'] = data[field.key].toLowerCase().replace(/\s+/g, '-');
    } else if (Array.isArray(data[field.key])) {
      data[field.key + '_lower'] = data[field.key].map((v) => v.toLowerCase().replace(/\s+/g, '-'));
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
 * Uses the compiled+cached version for performance.
 *
 * @param {string} template - Template string
 * @param {Object} data - Preprocessed data object
 * @returns {string} Rendered HTML
 */
export function renderTemplate(template, data) {
  return compileTemplate(template)(data);
}

/**
 * Full card render pipeline: preprocess row data then render template.
 *
 * @param {string} template - Template string
 * @param {Object} row - Raw CSV row
 * @param {Object[]} fields - Schema field definitions
 * @param {Object|null} cardType - Card type (for colorMapping)
 * @returns {string} Rendered HTML
 */
export function renderCard(template, row, fields, cardType) {
  const data = preprocessRow(row, fields, cardType);
  return renderTemplate(template, data);
}

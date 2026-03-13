/**
 * Card Type Registry
 * Manages loading, storing, and accessing card type definitions.
 *
 * A card type consists of:
 *  - id: unique string identifier
 *  - name: display name
 *  - description: short description
 *  - cardSize: { width, height } in CSS units
 *  - fields: array of field definitions
 *  - frontTemplate: HTML template string for card front
 *  - backTemplate: HTML template string for card back (optional)
 *  - css: CSS string scoped to [data-card-type="<id>"]
 *  - sampleData: optional array of sample row objects
 */

const registry = new Map();
let injectedStyles = new Map(); // id → <style> element

/**
 * Register a built-in card type by loading its files from card-types/<id>/.
 */
export async function registerBuiltIn(id) {
  const base = `card-types/${id}`;
  const [schemaRes, frontRes, backRes, cssRes] = await Promise.all([
    fetch(`${base}/card-type.json`),
    fetch(`${base}/front.html`),
    fetch(`${base}/back.html`),
    fetch(`${base}/style.css`),
  ]);

  if (!schemaRes.ok) throw new Error(`Failed to load ${base}/card-type.json`);
  if (!frontRes.ok) throw new Error(`Failed to load ${base}/front.html`);

  const schema = await schemaRes.json();
  const frontTemplate = await frontRes.text();
  // back.html is optional — only use it when the response was explicitly OK
  const backTemplate = backRes.ok ? await backRes.text() : null;
  const css = cssRes.ok ? await cssRes.text() : '';

  // Load sample data if available
  let sampleData = null;
  try {
    const sampleRes = await fetch(`${base}/sample-data.json`);
    if (sampleRes.ok) {
      sampleData = await sampleRes.json();
    } else {
      console.warn(`[card-maker] No sample data for "${id}" (${sampleRes.status})`);
    }
  } catch (err) {
    console.warn(`[card-maker] Failed to load sample data for "${id}":`, err.message);
  }

  const cardType = {
    id: schema.id || id,
    name: schema.name || id,
    description: schema.description || '',
    cardSize: schema.cardSize || { width: '63.5mm', height: '88.9mm' },
    fields: schema.fields || [],
    colorMapping: schema.colorMapping || null,
    aggregations: schema.aggregations || null,
    frontTemplate,
    backTemplate,
    css,
    sampleData,
    _builtIn: true,
  };

  register(cardType);
  return cardType;
}

/**
 * Register a card type from user-uploaded files.
 */
export async function registerFromUpload(schemaFile, frontFile, backFile, cssFile) {
  const schemaText = await readFile(schemaFile);
  const schema = JSON.parse(schemaText);

  const frontTemplate = await readFile(frontFile);
  const backTemplate = backFile ? await readFile(backFile) : null;
  const css = cssFile ? await readFile(cssFile) : '';

  // Validate schema structure
  if (!schema.id || typeof schema.id !== 'string') throw new Error('Schema must have a string "id" field.');
  if (!schema.name || typeof schema.name !== 'string') throw new Error('Schema must have a string "name" field.');
  if (!schema.fields || !Array.isArray(schema.fields)) throw new Error('Schema must have a "fields" array.');

  const validTypes = ['text', 'select', 'multi-select', 'tags', 'url', 'image', 'number', 'icon', 'qr'];
  for (const f of schema.fields) {
    if (!f.key || typeof f.key !== 'string') throw new Error(`Field missing string "key": ${JSON.stringify(f)}`);
    if (!f.type || typeof f.type !== 'string') throw new Error(`Field "${f.key}" missing "type".`);
    if (!validTypes.includes(f.type)) {
      throw new Error(`Field "${f.key}" has invalid type "${f.type}". Valid: ${validTypes.join(', ')}`);
    }
    if (f.options !== undefined && !Array.isArray(f.options)) {
      throw new Error(`Field "${f.key}" — "options" must be an array if provided.`);
    }
  }

  if (!frontTemplate.trim()) throw new Error('Front template cannot be empty.');

  // Warn about <script> tags in templates (not blocked — user may have a reason)
  if (/<script/i.test(frontTemplate) || (backTemplate && /<script/i.test(backTemplate))) {
    console.warn('[card-maker] Custom card type templates contain <script> tags. Only upload templates from trusted sources.');
  }

  const cardType = {
    id: schema.id,
    name: schema.name,
    description: schema.description || '',
    cardSize: schema.cardSize || { width: '63.5mm', height: '88.9mm' },
    fields: schema.fields,
    colorMapping: schema.colorMapping || null,
    aggregations: schema.aggregations || null,
    frontTemplate,
    backTemplate,
    css,
    sampleData: null,
    _sanitizeCss: true, // flag: sanitize CSS on injection (user-supplied)
  };

  register(cardType);
  return cardType;
}

/**
 * Register a card type from a single bundle JSON object.
 * The bundle contains schema fields + inlined frontTemplate, backTemplate, styles.
 * @param {Object} bundle - Parsed JSON bundle
 * @returns {Object} registered cardType
 */
export async function registerFromBundle(bundle) {
  if (!bundle || typeof bundle !== 'object') throw new Error('Invalid bundle: expected a JSON object.');
  if (!bundle.id || typeof bundle.id !== 'string') throw new Error('Bundle must have a string "id" field.');
  if (!bundle.name || typeof bundle.name !== 'string') throw new Error('Bundle must have a string "name" field.');
  if (!bundle.fields || !Array.isArray(bundle.fields)) throw new Error('Bundle must have a "fields" array.');
  if (!bundle.frontTemplate || typeof bundle.frontTemplate !== 'string') throw new Error('Bundle must have a "frontTemplate" string.');

  const validTypes = ['text', 'select', 'multi-select', 'tags', 'url', 'image', 'number', 'icon', 'qr', 'text-long'];
  for (const f of bundle.fields) {
    if (!f.key || typeof f.key !== 'string') throw new Error(`Field missing string "key": ${JSON.stringify(f)}`);
    if (!f.type || typeof f.type !== 'string') throw new Error(`Field "${f.key}" missing "type".`);
    if (!validTypes.includes(f.type)) {
      throw new Error(`Field "${f.key}" has invalid type "${f.type}". Valid: ${validTypes.join(', ')}`);
    }
    if (f.options !== undefined && !Array.isArray(f.options)) {
      throw new Error(`Field "${f.key}" — "options" must be an array if provided.`);
    }
  }

  if (/<script/i.test(bundle.frontTemplate) || (bundle.backTemplate && /<script/i.test(bundle.backTemplate))) {
    console.warn('[card-maker] Bundle templates contain <script> tags. Only load bundles from trusted sources.');
  }

  const cardType = {
    id: bundle.id,
    name: bundle.name,
    description: bundle.description || '',
    cardSize: bundle.cardSize || { width: '63.5mm', height: '88.9mm' },
    fields: bundle.fields,
    colorMapping: bundle.colorMapping || null,
    aggregations: bundle.aggregations || null,
    frontTemplate: bundle.frontTemplate,
    backTemplate: bundle.backTemplate || null,
    css: bundle.styles || bundle.css || '',
    sampleData: bundle.sampleData || null,
    _sanitizeCss: true,
  };

  register(cardType);
  return cardType;
}

/**
 * Sanitize user-supplied CSS to prevent external resource loading.
 * Strips @import rules and url() references to external (non-data:) sources.
 * @param {string} css
 * @returns {string}
 */
function sanitizeCss(css) {
  // Remove @import rules entirely
  let sanitized = css.replace(/@import\b[^;]+;/gi, '/* @import removed */');
  // Strip url() references that point to external URLs (allow data: and relative paths)
  sanitized = sanitized.replace(/url\(\s*(['"]?)(https?:\/\/[^)'"]+)\1\s*\)/gi, 'url(/* external url removed */)');
  return sanitized;
}

/**
 * Core registration: store in map and inject CSS.
 * @param {Object} cardType
 */
function register(cardType) {
  // Remove old styles if re-registering
  if (injectedStyles.has(cardType.id)) {
    injectedStyles.get(cardType.id).remove();
  }

  registry.set(cardType.id, cardType);

  // Inject CSS (sanitized for uploads; built-ins are trusted)
  if (cardType.css) {
    const style = document.createElement('style');
    style.dataset.cardType = cardType.id;
    style.textContent = cardType._sanitizeCss ? sanitizeCss(cardType.css) : cardType.css;
    document.head.appendChild(style);
    injectedStyles.set(cardType.id, style);
  }
}

/**
 * Get a registered card type by id.
 */
export function get(id) {
  return registry.get(id) || null;
}

/**
 * List all registered card type ids and names.
 */
export function listAll() {
  return Array.from(registry.values()).map(ct => ({ id: ct.id, name: ct.name, builtIn: !!ct._builtIn }));
}

// -- helpers --

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

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
    fetch(`${base}/back.html`).catch(() => null),
    fetch(`${base}/style.css`),
  ]);

  if (!schemaRes.ok) throw new Error(`Failed to load ${base}/card-type.json`);
  if (!frontRes.ok) throw new Error(`Failed to load ${base}/front.html`);

  const schema = await schemaRes.json();
  const frontTemplate = await frontRes.text();
  const backTemplate = backRes && backRes.ok ? await backRes.text() : null;
  const css = cssRes.ok ? await cssRes.text() : '';

  // Load sample data if available
  let sampleData = null;
  try {
    const sampleRes = await fetch(`${base}/sample-data.json`);
    if (sampleRes.ok) sampleData = await sampleRes.json();
  } catch (_) { /* no sample data */ }

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

  // Validate
  if (!schema.id) throw new Error('Schema must have an "id" field.');
  if (!schema.name) throw new Error('Schema must have a "name" field.');
  if (!schema.fields || !Array.isArray(schema.fields)) throw new Error('Schema must have a "fields" array.');
  for (const f of schema.fields) {
    if (!f.key) throw new Error(`Field missing "key": ${JSON.stringify(f)}`);
    if (!f.type) throw new Error(`Field "${f.key}" missing "type".`);
    const validTypes = ['text', 'select', 'multi-select', 'tags', 'url', 'image', 'number', 'icon', 'qr'];
    if (!validTypes.includes(f.type)) {
      throw new Error(`Field "${f.key}" has invalid type "${f.type}". Valid: ${validTypes.join(', ')}`);
    }
  }

  if (!frontTemplate.trim()) throw new Error('Front template cannot be empty.');

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
  };

  register(cardType);
  return cardType;
}

/**
 * Core registration: store in map and inject CSS.
 */
function register(cardType) {
  // Remove old styles if re-registering
  if (injectedStyles.has(cardType.id)) {
    injectedStyles.get(cardType.id).remove();
  }

  registry.set(cardType.id, cardType);

  // Inject CSS
  if (cardType.css) {
    const style = document.createElement('style');
    style.dataset.cardType = cardType.id;
    style.textContent = cardType.css;
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
  return Array.from(registry.values()).map(ct => ({ id: ct.id, name: ct.name }));
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

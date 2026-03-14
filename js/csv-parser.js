/**
 * CSV parsing wrapper around Papa Parse.
 */

/**
 * Parse a CSV File object into an array of row objects.
 * @param {File|string} input - File object or CSV string
 * @returns {Promise<{data: Object[], errors: string[]}>}
 */
export function parseCsv(input) {
  return new Promise((resolve) => {
    const config = {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const errors = results.errors
          .filter(e => e.type !== 'FieldMismatch') // Allow ragged rows
          .map(e => `Row ${e.row}: ${e.message}`);
        resolve({ data: results.data, errors });
      },
      error: (err) => {
        resolve({ data: [], errors: [err.message] });
      }
    };

    Papa.parse(input, config);
  });
}

/**
 * Generate a CSV string from a card type's fields (for template/sample downloads).
 * Uses field keys as column headers (matching the internal data model).
 * @param {Object[]} fields - Schema fields array
 * @param {Object[]} [sampleRows] - Optional sample data rows
 * @returns {string} CSV string
 */
export function generateCsv(fields, sampleRows) {
  const keys = fields.map(f => f.key);
  const lines = [keys.join(',')];

  if (sampleRows) {
    for (const row of sampleRows) {
      const vals = keys.map(k => {
        let v = row[k] ?? '';
        v = String(v);
        // Quote if contains comma, quote, or newline
        if (v.includes(',') || v.includes('"') || v.includes('\n')) {
          v = '"' + v.replace(/"/g, '""') + '"';
        }
        return v;
      });
      lines.push(vals.join(','));
    }
  }

  return lines.join('\n');
}

/**
 * Remap CSV row headers from labels (or old keys) to current field keys.
 * Matches by exact key, exact label, or case-insensitive label.
 * @param {Object[]} rows - Parsed CSV rows (header-keyed objects)
 * @param {Object[]} fields - Schema fields array
 * @returns {Object[]} Rows with keys matching field.key
 */
export function remapHeaders(rows, fields) {
  if (!rows.length || !fields.length) return rows;

  // Build lookup: header string → field key
  const headerToKey = {};
  for (const f of fields) {
    headerToKey[f.key] = f.key;
    if (f.label) {
      headerToKey[f.label] = f.key;
      headerToKey[f.label.toLowerCase()] = f.key;
    }
  }

  // Check if remapping is needed (first row headers already match keys)
  const sampleHeaders = Object.keys(rows[0]);
  const needsRemap = sampleHeaders.some(h => !(h in headerToKey) || headerToKey[h] !== h);
  if (!needsRemap) return rows;

  return rows.map(row => {
    const mapped = {};
    for (const [header, value] of Object.entries(row)) {
      const key = headerToKey[header] || headerToKey[header.toLowerCase()] || header;
      mapped[key] = value;
    }
    return mapped;
  });
}

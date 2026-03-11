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

    if (typeof input === 'string') {
      Papa.parse(input, config);
    } else {
      Papa.parse(input, config);
    }
  });
}

/**
 * Generate a CSV string from a card type's fields (for template/sample downloads).
 * @param {Object[]} fields - Schema fields array
 * @param {Object[]} [sampleRows] - Optional sample data rows
 * @returns {string} CSV string
 */
export function generateCsv(fields, sampleRows) {
  const headers = fields.map(f => f.key);
  const lines = [headers.join(',')];

  if (sampleRows) {
    for (const row of sampleRows) {
      const vals = headers.map(h => {
        let v = row[h] ?? '';
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

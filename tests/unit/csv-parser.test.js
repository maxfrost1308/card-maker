import { describe, it, expect, beforeAll } from 'vitest';
import Papa from 'papaparse';
import { parseCsv, generateCsv, remapHeaders } from '../../js/csv-parser.js';

// PapaParse is loaded via <script> tag in the app; expose it as a global for tests
beforeAll(() => {
  globalThis.Papa = Papa;
});

// ── parseCsv ───────────────────────────────────────────────────────────────────

describe('parseCsv', () => {
  it('parses a basic CSV string', async () => {
    const { data, errors } = await parseCsv('name,color\nFern,green\nCactus,brown');
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(2);
    expect(data[0]).toEqual({ name: 'Fern', color: 'green' });
    expect(data[1]).toEqual({ name: 'Cactus', color: 'brown' });
  });

  it('trims header whitespace', async () => {
    const { data } = await parseCsv(' name , color \nFern,green');
    expect(Object.keys(data[0])).toEqual(['name', 'color']);
  });

  it('skips empty lines', async () => {
    const { data } = await parseCsv('name,color\nFern,green\n\n\nCactus,brown');
    expect(data).toHaveLength(2);
  });

  it('returns empty data for empty CSV', async () => {
    const { data, errors } = await parseCsv('');
    expect(data).toHaveLength(0);
  });

  it('filters out FieldMismatch errors (allows ragged rows)', async () => {
    // Ragged row has fewer fields than headers — should not appear in errors
    const { errors } = await parseCsv('name,color,size\nFern,green\nCactus,brown,small');
    expect(errors).toHaveLength(0);
  });

  it('handles values with commas in quotes', async () => {
    const { data } = await parseCsv('name,desc\nFern,"tall, leafy"');
    expect(data[0].desc).toBe('tall, leafy');
  });

  it('handles values with double-quote escaping', async () => {
    const { data } = await parseCsv('name,desc\nFern,"he said ""hi"""');
    expect(data[0].desc).toBe('he said "hi"');
  });

  it('handles single-row CSV (header only → zero data rows)', async () => {
    const { data } = await parseCsv('name,color');
    expect(data).toHaveLength(0);
  });
});

// ── generateCsv ───────────────────────────────────────────────────────────────

describe('generateCsv', () => {
  const fields = [
    { key: 'name' },
    { key: 'color' },
  ];

  it('generates a CSV with just headers when no sample rows', () => {
    const csv = generateCsv(fields);
    expect(csv).toBe('name,color');
  });

  it('generates CSV with header and data rows', () => {
    const rows = [{ name: 'Fern', color: 'green' }];
    const csv = generateCsv(fields, rows);
    expect(csv).toBe('name,color\nFern,green');
  });

  it('quotes values containing commas', () => {
    const rows = [{ name: 'Fern, Jr.', color: 'green' }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain('"Fern, Jr."');
  });

  it('quotes values containing double quotes', () => {
    const rows = [{ name: 'Say "hi"', color: 'green' }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain('"Say ""hi"""');
  });

  it('quotes values containing newlines', () => {
    const rows = [{ name: 'Line1\nLine2', color: 'green' }];
    const csv = generateCsv(fields, rows);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it('handles missing field values as empty string', () => {
    const rows = [{ name: 'Fern' }]; // no color
    const csv = generateCsv(fields, rows);
    expect(csv).toBe('name,color\nFern,');
  });
});

// ── remapHeaders ──────────────────────────────────────────────────────────────

describe('remapHeaders', () => {
  const fields = [
    { key: 'name', label: 'Plant Name' },
    { key: 'color', label: 'Color' },
  ];

  it('returns rows unchanged when keys already match', () => {
    const rows = [{ name: 'Fern', color: 'green' }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: 'Fern', color: 'green' });
  });

  it('remaps by exact label', () => {
    const rows = [{ 'Plant Name': 'Fern', 'Color': 'green' }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: 'Fern', color: 'green' });
  });

  it('remaps by case-insensitive label', () => {
    const rows = [{ 'plant name': 'Fern', 'color': 'green' }];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: 'Fern', color: 'green' });
  });

  it('preserves unmapped columns as-is', () => {
    const rows = [{ name: 'Fern', color: 'green', extra: 'bonus' }];
    const result = remapHeaders(rows, fields);
    expect(result[0].extra).toBe('bonus');
  });

  it('returns empty array when rows is empty', () => {
    const result = remapHeaders([], fields);
    expect(result).toEqual([]);
  });

  it('returns rows unchanged when fields is empty', () => {
    const rows = [{ name: 'Fern' }];
    const result = remapHeaders(rows, []);
    expect(result).toEqual(rows);
  });

  it('remaps multiple rows', () => {
    const rows = [
      { 'Plant Name': 'Fern', 'Color': 'green' },
      { 'Plant Name': 'Cactus', 'Color': 'brown' },
    ];
    const result = remapHeaders(rows, fields);
    expect(result[0]).toEqual({ name: 'Fern', color: 'green' });
    expect(result[1]).toEqual({ name: 'Cactus', color: 'brown' });
  });
});

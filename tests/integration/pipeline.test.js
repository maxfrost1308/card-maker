/**
 * Integration tests for core Card Maker workflows.
 *
 * These tests verify that modules work together correctly:
 * - card-type-registry + template-renderer: register type → render sample data
 * - csv-parser + remapHeaders: load CSV → verify row count and mapping
 * - state: setRowData + getData → verify data mutation
 *
 * DOM-heavy workflows (table view, edit modal) are covered in unit tests for
 * their individual modules. Full E2E browser tests are a future addition.
 */

import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import Papa from 'papaparse';

beforeAll(() => {
  globalThis.Papa = Papa;
  globalThis.fetch = vi.fn();
});

// ── Workflow 1: Register card type → render sample data ───────────────────────

describe('register card type → render sample data', () => {
  it('renders a card using the registered type and sample data', async () => {
    // Dynamically import after mocks are set
    const { registerFromUpload, get } = await import('../../js/card-type-registry.js');
    const { renderCard } = await import('../../js/template-renderer.js');

    const schema = JSON.stringify({
      id: 'integration-test',
      name: 'Integration Test',
      fields: [
        { key: 'title', type: 'text', label: 'Title' },
        { key: 'tags', type: 'tags', separator: '|', label: 'Tags' },
      ],
    });

    await registerFromUpload(
      new File([schema], 'schema.json'),
      new File(['<div class="card">{{title}}</div>'], 'front.html'),
      null,
      null,
    );

    const ct = get('integration-test');
    expect(ct).not.toBeNull();
    expect(ct.name).toBe('Integration Test');

    const row = { title: 'Dragon', tags: 'fire|beast' };
    const html = renderCard(ct.frontTemplate, row, ct.fields, ct);
    expect(html).toContain('Dragon');
    expect(html).not.toContain('{{title}}'); // substitution applied
  });

  it('renders multi-select tags as separate items when iterated', async () => {
    const { get } = await import('../../js/card-type-registry.js');
    const { renderCard } = await import('../../js/template-renderer.js');
    const { registerFromUpload } = await import('../../js/card-type-registry.js');

    const schema = JSON.stringify({
      id: 'tags-test',
      name: 'Tags Test',
      fields: [{ key: 'tags', type: 'tags', separator: '|' }],
    });

    await registerFromUpload(
      new File([schema], 's.json'),
      new File(['{{#tags}}<span>{{.}}</span>{{/tags}}'], 'front.html'),
      null,
      null,
    );

    const ct = get('tags-test');
    const html = renderCard(ct.frontTemplate, { tags: 'fire|water|earth' }, ct.fields, ct);
    expect(html).toContain('<span>fire</span>');
    expect(html).toContain('<span>water</span>');
    expect(html).toContain('<span>earth</span>');
  });
});

// ── Workflow 2: Load CSV → verify row count and field mapping ─────────────────

describe('load CSV → verify row count and field mapping', () => {
  it('parses CSV and returns correct row count', async () => {
    const { parseCsv } = await import('../../js/csv-parser.js');
    const csv = 'title,tags\nDragon,fire|beast\nGoblin,small|sneaky\nElf,wise|archer';
    const { data, errors } = await parseCsv(csv);
    expect(errors).toHaveLength(0);
    expect(data).toHaveLength(3);
  });

  it('remaps CSV headers to schema field keys', async () => {
    const { parseCsv, remapHeaders } = await import('../../js/csv-parser.js');
    const csv = 'Card Title,Card Tags\nDragon,fire|beast';
    const { data } = await parseCsv(csv);
    const fields = [
      { key: 'title', label: 'Card Title' },
      { key: 'tags', label: 'Card Tags' },
    ];
    const remapped = remapHeaders(data, fields);
    expect(remapped[0]).toEqual({ title: 'Dragon', tags: 'fire|beast' });
  });

  it('pipeline: parse CSV → remap → render card', async () => {
    const { parseCsv, remapHeaders } = await import('../../js/csv-parser.js');
    const { renderCard } = await import('../../js/template-renderer.js');

    const csv = 'Name,Color\nFern,green\nCactus,brown';
    const fields = [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'color', label: 'Color', type: 'text' },
    ];
    const { data } = await parseCsv(csv);
    const remapped = remapHeaders(data, fields);

    expect(remapped).toHaveLength(2);
    expect(remapped[0].name).toBe('Fern');

    const html = renderCard('{{name}} ({{color}})', remapped[0], fields, null);
    expect(html).toBe('Fern (green)');
  });
});

// ── Workflow 3: state.js data mutation ────────────────────────────────────────

describe('state: setRowData → getData reflects change', () => {
  it('setData + getData round-trips the data array', async () => {
    const { setData, getData } = await import('../../js/state.js');
    const rows = [{ name: 'Fern' }, { name: 'Cactus' }];
    setData(rows);
    expect(getData()).toBe(rows);
    expect(getData()[0].name).toBe('Fern');
  });

  it('setRowData mutates a single row', async () => {
    const { setData, setRowData, getData } = await import('../../js/state.js');
    setData([{ name: 'Fern' }, { name: 'Cactus' }]);
    setRowData(0, { name: 'Updated Fern' });
    expect(getData()[0].name).toBe('Updated Fern');
    expect(getData()[1].name).toBe('Cactus'); // unchanged
  });

  it('deleteRows removes correct entries and preserves order', async () => {
    const { setData, deleteRows, getData } = await import('../../js/state.js');
    setData([{ n: 'a' }, { n: 'b' }, { n: 'c' }, { n: 'd' }]);
    deleteRows([0, 2]); // remove 'a' and 'c'
    const names = getData().map(r => r.n);
    expect(names).toEqual(['b', 'd']);
  });

  it('setData(null) clears data', async () => {
    const { setData, getData } = await import('../../js/state.js');
    setData([{ name: 'x' }]);
    setData(null);
    expect(getData()).toBeNull();
  });
});

// ── Workflow 4: CSV round-trip ────────────────────────────────────────────────

describe('CSV round-trip: parse → mutate → generate', () => {
  it('parse → edit row → re-generate CSV preserves all rows', async () => {
    const { parseCsv, generateCsv } = await import('../../js/csv-parser.js');

    const original = 'name,color\nFern,green\nCactus,brown';
    const { data } = await parseCsv(original);
    data[0].color = 'dark-green'; // edit a value

    const fields = [{ key: 'name' }, { key: 'color' }];
    const regenerated = generateCsv(fields, data);

    expect(regenerated).toContain('name,color');
    expect(regenerated).toContain('Fern,dark-green');
    expect(regenerated).toContain('Cactus,brown');
  });
});

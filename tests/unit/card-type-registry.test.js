import { describe, it, expect, vi, beforeEach } from 'vitest';

// card-type-registry uses document.createElement and document.head — JSDOM provides these.

// We need to mock fetch before importing the module
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Import after setting up fetch mock
const { registerBuiltIn, registerFromUpload, get, listAll } = await import('../../js/card-type-registry.js');

// Helper: create a mock File object for registerFromUpload
function mockFile(content, name) {
  return new File([content], name, { type: 'text/plain' });
}

const minimalSchema = JSON.stringify({
  id: 'test-card',
  name: 'Test Card',
  fields: [{ key: 'title', type: 'text' }],
});

const minimalFront = '<div>{{title}}</div>';

// ── registerFromUpload ────────────────────────────────────────────────────────

describe('registerFromUpload', () => {
  it('registers a valid card type', async () => {
    await registerFromUpload(
      mockFile(minimalSchema, 'card-type.json'),
      mockFile(minimalFront, 'front.html'),
      null,
      null,
    );
    const ct = get('test-card');
    expect(ct).not.toBeNull();
    expect(ct.name).toBe('Test Card');
    expect(ct.id).toBe('test-card');
  });

  it('stores front template', async () => {
    await registerFromUpload(
      mockFile(minimalSchema, 'card-type.json'),
      mockFile('<p>front</p>', 'front.html'),
      null,
      null,
    );
    expect(get('test-card').frontTemplate).toBe('<p>front</p>');
  });

  it('stores back template when provided', async () => {
    await registerFromUpload(
      mockFile(minimalSchema, 'card-type.json'),
      mockFile(minimalFront, 'front.html'),
      mockFile('<p>back</p>', 'back.html'),
      null,
    );
    expect(get('test-card').backTemplate).toBe('<p>back</p>');
  });

  it('sets backTemplate to null when not provided', async () => {
    await registerFromUpload(
      mockFile(minimalSchema, 'card-type.json'),
      mockFile(minimalFront, 'front.html'),
      null,
      null,
    );
    expect(get('test-card').backTemplate).toBeNull();
  });

  it('throws when schema has no id', async () => {
    const bad = JSON.stringify({ name: 'No ID', fields: [] });
    await expect(
      registerFromUpload(mockFile(bad, 'schema.json'), mockFile(minimalFront, 'front.html'), null, null),
    ).rejects.toThrow(/id/);
  });

  it('throws when schema has no name', async () => {
    const bad = JSON.stringify({ id: 'x', fields: [] });
    await expect(
      registerFromUpload(mockFile(bad, 'schema.json'), mockFile(minimalFront, 'front.html'), null, null),
    ).rejects.toThrow(/name/);
  });

  it('throws when schema has no fields array', async () => {
    const bad = JSON.stringify({ id: 'x', name: 'X' });
    await expect(
      registerFromUpload(mockFile(bad, 'schema.json'), mockFile(minimalFront, 'front.html'), null, null),
    ).rejects.toThrow(/fields/);
  });

  it('throws when a field has no key', async () => {
    const bad = JSON.stringify({ id: 'x', name: 'X', fields: [{ type: 'text' }] });
    await expect(
      registerFromUpload(mockFile(bad, 'schema.json'), mockFile(minimalFront, 'front.html'), null, null),
    ).rejects.toThrow(/key/);
  });

  it('throws when a field has no type', async () => {
    const bad = JSON.stringify({ id: 'x', name: 'X', fields: [{ key: 'title' }] });
    await expect(
      registerFromUpload(mockFile(bad, 'schema.json'), mockFile(minimalFront, 'front.html'), null, null),
    ).rejects.toThrow(/type/);
  });

  it('throws when a field has an invalid type', async () => {
    const bad = JSON.stringify({ id: 'x', name: 'X', fields: [{ key: 'title', type: 'invalid-type' }] });
    await expect(
      registerFromUpload(mockFile(bad, 'schema.json'), mockFile(minimalFront, 'front.html'), null, null),
    ).rejects.toThrow(/invalid type/);
  });

  it('throws when front template is empty', async () => {
    await expect(
      registerFromUpload(mockFile(minimalSchema, 'schema.json'), mockFile('   ', 'front.html'), null, null),
    ).rejects.toThrow(/empty/i);
  });

  it('re-registration replaces old entry', async () => {
    const schema1 = JSON.stringify({ id: 'replaceable', name: 'V1', fields: [] });
    const schema2 = JSON.stringify({ id: 'replaceable', name: 'V2', fields: [] });
    await registerFromUpload(mockFile(schema1, 's.json'), mockFile('<p>f</p>', 'f.html'), null, null);
    await registerFromUpload(mockFile(schema2, 's.json'), mockFile('<p>f</p>', 'f.html'), null, null);
    expect(get('replaceable').name).toBe('V2');
  });
});

// ── get ───────────────────────────────────────────────────────────────────────

describe('get', () => {
  it('returns null for unknown id', () => {
    expect(get('does-not-exist-xyz')).toBeNull();
  });

  it('returns the registered card type by id', async () => {
    await registerFromUpload(
      mockFile(JSON.stringify({ id: 'get-test', name: 'Get Test', fields: [] }), 's.json'),
      mockFile('<p>f</p>', 'f.html'),
      null,
      null,
    );
    const ct = get('get-test');
    expect(ct).not.toBeNull();
    expect(ct.id).toBe('get-test');
  });
});

// ── listAll ───────────────────────────────────────────────────────────────────

describe('listAll', () => {
  it('returns an array of { id, name } objects', async () => {
    const list = listAll();
    expect(Array.isArray(list)).toBe(true);
    for (const item of list) {
      expect(item).toHaveProperty('id');
      expect(item).toHaveProperty('name');
    }
  });

  it('includes a freshly registered card type', async () => {
    await registerFromUpload(
      mockFile(JSON.stringify({ id: 'list-test', name: 'List Test', fields: [] }), 's.json'),
      mockFile('<p>f</p>', 'f.html'),
      null,
      null,
    );
    const ids = listAll().map((c) => c.id);
    expect(ids).toContain('list-test');
  });
});

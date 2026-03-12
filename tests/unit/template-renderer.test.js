import { describe, it, expect, vi, beforeEach } from 'vitest';
import { preprocessRow, renderTemplate, renderCard } from '../../js/template-renderer.js';

// Mock external dependencies
vi.mock('../../js/icon-loader.js', () => ({
  resolveIconUrl: vi.fn((name) => name ? `https://example.com/icons/${name}.svg` : null),
}));

vi.mock('../../js/qr-code.js', () => ({
  generateQrSvg: vi.fn((val) => `<svg data-qr="${val}"></svg>`),
}));

// ── preprocessRow ──────────────────────────────────────────────────────────────

describe('preprocessRow', () => {
  const fields = [
    { key: 'name', type: 'text', label: 'Name' },
    { key: 'tags', type: 'tags', separator: '|' },
    { key: 'types', type: 'multi-select', separator: ',' },
    { key: 'rarity', type: 'select' },
  ];

  it('passes through simple text values', () => {
    const result = preprocessRow({ name: 'Fern' }, fields, null);
    expect(result.name).toBe('Fern');
  });

  it('trims string values', () => {
    const result = preprocessRow({ name: '  Fern  ' }, fields, null);
    expect(result.name).toBe('Fern');
  });

  it('splits multi-select fields into arrays using default separator |', () => {
    const result = preprocessRow({ tags: 'fire|water|earth' }, fields, null);
    expect(result.tags).toEqual(['fire', 'water', 'earth']);
  });

  it('splits multi-select fields using custom separator', () => {
    const result = preprocessRow({ types: 'warrior,mage,rogue' }, fields, null);
    expect(result.types).toEqual(['warrior', 'mage', 'rogue']);
  });

  it('returns empty array for empty multi-select', () => {
    const result = preprocessRow({ tags: '' }, fields, null);
    expect(result.tags).toBe('');
  });

  it('adds _lower variant for string fields', () => {
    const result = preprocessRow({ name: 'Fire Dragon' }, fields, null);
    expect(result.name_lower).toBe('fire-dragon');
  });

  it('adds _lower array variant for multi-select fields', () => {
    const result = preprocessRow({ tags: 'Fire|Water' }, fields, null);
    expect(result.tags_lower).toEqual(['fire', 'water']);
  });

  it('fills missing fields with empty string', () => {
    const result = preprocessRow({}, fields, null);
    expect(result.name).toBe('');
  });

  it('carries forward extra CSV columns not in schema', () => {
    const result = preprocessRow({ name: 'Fern', extra_col: 'bonus' }, fields, null);
    expect(result.extra_col).toBe('bonus');
    expect(result.extra_col_lower).toBe('bonus');
  });

  it('applies colorMapping from card type', () => {
    const cardType = {
      colorMapping: {
        color: {
          field: 'rarity',
          map: { common: '#aaa', rare: '#gold' },
          default: '#fff',
        },
      },
    };
    const result = preprocessRow({ rarity: 'rare' }, fields, cardType);
    expect(result.color).toBe('#gold');
  });

  it('uses colorMapping default when source value not in map', () => {
    const cardType = {
      colorMapping: {
        color: {
          field: 'rarity',
          map: { common: '#aaa' },
          default: '#fff',
        },
      },
    };
    const result = preprocessRow({ rarity: 'legendary' }, fields, cardType);
    expect(result.color).toBe('#fff');
  });

  it('does not overwrite existing colorMapping target field', () => {
    const cardType = {
      colorMapping: {
        color: {
          field: 'rarity',
          map: { common: '#aaa' },
          default: '#fff',
        },
      },
    };
    const result = preprocessRow({ rarity: 'common', color: 'red' }, fields, cardType);
    expect(result.color).toBe('red');
  });
});

// ── renderTemplate ─────────────────────────────────────────────────────────────

describe('renderTemplate', () => {
  it('substitutes {{field}} with HTML-escaped value', () => {
    const result = renderTemplate('Hello {{name}}!', { name: 'World' });
    expect(result).toBe('Hello World!');
  });

  it('escapes HTML in {{field}} substitution', () => {
    const result = renderTemplate('{{content}}', { content: '<script>alert("xss")</script>' });
    expect(result).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('renders {{{field}}} without escaping (raw)', () => {
    const result = renderTemplate('{{{html}}}', { html: '<b>bold</b>' });
    expect(result).toBe('<b>bold</b>');
  });

  it('returns empty string for undefined fields in {{}}', () => {
    const result = renderTemplate('{{missing}}', {});
    expect(result).toBe('');
  });

  it('renders array values in {{field}} as comma-joined escaped string', () => {
    const result = renderTemplate('{{tags}}', { tags: ['fire', 'water'] });
    expect(result).toBe('fire, water');
  });

  it('renders {{#field}}...{{/field}} as conditional block (truthy)', () => {
    const result = renderTemplate('{{#name}}has name{{/name}}', { name: 'Fern' });
    expect(result).toBe('has name');
  });

  it('does not render {{#field}}...{{/field}} when falsy', () => {
    const result = renderTemplate('{{#name}}has name{{/name}}', { name: '' });
    expect(result).toBe('');
  });

  it('iterates over array with {{#field}}{{.}}{{/field}}', () => {
    const result = renderTemplate('{{#tags}}<span>{{.}}</span>{{/tags}}', { tags: ['fire', 'water'] });
    expect(result).toBe('<span>fire</span><span>water</span>');
  });

  it('renders {{^field}} inverted block when value is empty', () => {
    const result = renderTemplate('{{^name}}no name{{/name}}', { name: '' });
    expect(result).toBe('no name');
  });

  it('does not render {{^field}} inverted block when value is truthy', () => {
    const result = renderTemplate('{{^name}}no name{{/name}}', { name: 'Fern' });
    expect(result).toBe('');
  });

  it('renders {{^field}} inverted block when array is empty', () => {
    const result = renderTemplate('{{^tags}}no tags{{/tags}}', { tags: [] });
    expect(result).toBe('no tags');
  });

  it('renders {{{icon:field}}} as img tag', () => {
    const result = renderTemplate('{{{icon:iconName}}}', { iconName: 'sword' });
    expect(result).toContain('<img');
    expect(result).toContain('icon-img');
    expect(result).toContain('sword');
  });

  it('renders empty string for {{{icon:field}}} when field is empty', () => {
    const result = renderTemplate('{{{icon:iconName}}}', { iconName: '' });
    expect(result).toBe('');
  });

  it('renders {{{qr:field}}} as SVG', () => {
    const result = renderTemplate('{{{qr:url}}}', { url: 'https://example.com' });
    expect(result).toContain('<svg');
    expect(result).toContain('https://example.com');
  });

  it('renders empty string for {{{qr:field}}} when field is empty', () => {
    const result = renderTemplate('{{{qr:url}}}', { url: '' });
    expect(result).toBe('');
  });

  it('handles multiple substitutions in one template', () => {
    const result = renderTemplate('{{a}} and {{b}}', { a: 'foo', b: 'bar' });
    expect(result).toBe('foo and bar');
  });

  it('renders {{@index}} inside array iteration', () => {
    const result = renderTemplate('{{#items}}{{@index}}:{{.}} {{/items}}', { items: ['a', 'b'] });
    expect(result).toBe('0:a 1:b ');
  });
});

// ── renderCard ─────────────────────────────────────────────────────────────────

describe('renderCard', () => {
  const fields = [{ key: 'name', type: 'text' }, { key: 'tags', type: 'tags', separator: '|' }];

  it('preprocesses and renders a full card', () => {
    const result = renderCard('{{name}}: {{tags}}', { name: 'Fern', tags: 'plant|green' }, fields, null);
    expect(result).toBe('Fern: plant, green');
  });

  it('handles missing fields gracefully', () => {
    const result = renderCard('{{name}}', {}, fields, null);
    expect(result).toBe('');
  });
});

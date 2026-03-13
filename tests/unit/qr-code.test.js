import { describe, it, expect } from 'vitest';
import { generateQrSvg } from '../../js/qr-code.js';

describe('generateQrSvg', () => {
  it('returns a string', () => {
    const result = generateQrSvg('hello');
    expect(typeof result).toBe('string');
  });

  it('produces valid SVG markup (has <svg> open and close tags)', () => {
    const result = generateQrSvg('https://example.com');
    expect(result).toMatch(/^<svg /);
    expect(result).toMatch(/<\/svg>$/);
  });

  it('includes xmlns attribute', () => {
    const result = generateQrSvg('test');
    expect(result).toContain('xmlns="http://www.w3.org/2000/svg"');
  });

  it('includes a viewBox attribute', () => {
    const result = generateQrSvg('test');
    expect(result).toContain('viewBox=');
  });

  it('includes path data (the QR modules)', () => {
    const result = generateQrSvg('test');
    expect(result).toContain('<path d="');
  });

  it('is deterministic — same input produces same output', () => {
    const input = 'https://example.com/card-maker';
    const a = generateQrSvg(input);
    const b = generateQrSvg(input);
    expect(a).toBe(b);
  });

  it('produces different output for different inputs', () => {
    const a = generateQrSvg('hello');
    const b = generateQrSvg('world');
    expect(a).not.toBe(b);
  });

  it('handles URL input', () => {
    const result = generateQrSvg('https://github.com/example/card-maker');
    expect(result).toMatch(/^<svg /);
  });

  it('handles short alphanumeric input', () => {
    const result = generateQrSvg('ABC123');
    expect(result).toMatch(/^<svg /);
  });

  it('handles numeric-only input', () => {
    const result = generateQrSvg('1234567890');
    expect(result).toMatch(/^<svg /);
  });

  it('snapshot: known input produces expected SVG structure', () => {
    const result = generateQrSvg('HELLO WORLD');
    expect(result).toMatchSnapshot();
  });
});

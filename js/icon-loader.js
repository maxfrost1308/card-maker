/**
 * Icon Loader — fetches and caches SVG icons from game-icons.net.
 *
 * game-icons.net URL pattern:
 *   https://game-icons.net/icons/ffffff/000000/1x1/<author>/<icon-name>.svg
 *
 * To avoid rate-limiting when rendering 200+ cards, this module:
 *  - Caches every fetched SVG in memory (Map)
 *  - Deduplicates concurrent requests for the same icon
 *  - Uses a concurrency limiter (max 4 parallel fetches)
 *  - Provides a preload function to batch-fetch unique icons before render
 */

const svgCache = new Map();       // iconName → SVG string (inline-ready)
const pendingFetches = new Map(); // iconName → Promise<string>
const MAX_CONCURRENT = 4;
let activeCount = 0;
const queue = [];                 // { resolve, reject, url, key }

/**
 * Resolve a game-icons.net icon name to a full URL.
 * Accepts:
 *  - Full URL: https://game-icons.net/icons/...
 *  - Short name: "delapouite/oak" or just "oak" (defaults to delapouite author)
 *  - Name with color override: "oak#ff0000" (fill color)
 */
export function resolveIconUrl(nameOrUrl, fgColor = '000000', bgColor = 'ffffff') {
  if (!nameOrUrl) return null;
  nameOrUrl = nameOrUrl.trim();

  // Already a full URL
  if (nameOrUrl.startsWith('http://') || nameOrUrl.startsWith('https://')) {
    return nameOrUrl;
  }

  // Parse optional color suffix: "icon-name#hexcolor"
  let name = nameOrUrl;
  if (name.includes('#')) {
    const parts = name.split('#');
    name = parts[0];
    fgColor = parts[1] || fgColor;
  }

  // Default author if not specified
  if (!name.includes('/')) {
    name = `delapouite/${name}`;
  }

  return `https://game-icons.net/icons/${bgColor}/${fgColor}/1x1/${name}.svg`;
}

/**
 * Normalize an icon reference to a cache key.
 */
function cacheKey(nameOrUrl) {
  return nameOrUrl.trim().toLowerCase().replace(/\.svg$/, '');
}

/**
 * Fetch a single SVG icon with concurrency limiting.
 * Returns the SVG markup string (suitable for inline use).
 */
export async function fetchIcon(nameOrUrl, options = {}) {
  const key = cacheKey(nameOrUrl);

  // Return from cache
  if (svgCache.has(key)) return svgCache.get(key);

  // Return in-flight request
  if (pendingFetches.has(key)) return pendingFetches.get(key);

  const url = resolveIconUrl(nameOrUrl, options.fg, options.bg);
  if (!url) return '';

  const promise = enqueue(url, key);
  pendingFetches.set(key, promise);
  return promise;
}

function enqueue(url, key) {
  return new Promise((resolve, reject) => {
    queue.push({ url, key, resolve, reject });
    drain();
  });
}

function drain() {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift();
    activeCount++;
    doFetch(job).finally(() => {
      activeCount--;
      drain();
    });
  }
}

async function doFetch({ url, key, resolve, reject }) {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      // Return a fallback placeholder on failure
      const fallback = makeFallbackSvg(key);
      svgCache.set(key, fallback);
      pendingFetches.delete(key);
      resolve(fallback);
      return;
    }
    let svg = await res.text();

    // Strip XML declaration and doctype if present
    svg = svg.replace(/<\?xml[^>]*\?>/gi, '').replace(/<!DOCTYPE[^>]*>/gi, '').trim();

    // Strip the game-icons.net black background rectangle
    svg = svg.replace(/<path d="M0 0h512v512H0z"\s*\/?>/, '');

    // Make it inline-friendly: remove fixed width/height on root <svg> and ensure viewBox
    svg = svg.replace(/<svg([^>]*)>/, (match, attrs) => {
      // Remove width/height attributes for flexible sizing
      let cleaned = attrs.replace(/\s(width|height)="[^"]*"/gi, '');
      // Ensure we have a viewBox
      if (!/viewBox/i.test(cleaned)) {
        cleaned += ' viewBox="0 0 512 512"';
      }
      return `<svg${cleaned}>`;
    });

    svgCache.set(key, svg);
    pendingFetches.delete(key);
    resolve(svg);
  } catch (err) {
    const fallback = makeFallbackSvg(key);
    svgCache.set(key, fallback);
    pendingFetches.delete(key);
    resolve(fallback);
  }
}

function makeFallbackSvg(key) {
  const label = key.split('/').pop() || '?';
  return `<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
    <rect width="512" height="512" rx="64" fill="#e0e0e0"/>
    <text x="256" y="280" text-anchor="middle" font-size="64" fill="#999" font-family="system-ui">${label}</text>
  </svg>`;
}

/**
 * Preload a list of icon names/URLs. Returns when all are cached.
 * Use this before rendering many cards to avoid waterfall requests.
 */
export async function preloadIcons(names) {
  const unique = [...new Set(names.filter(Boolean).map(n => n.trim()))];
  await Promise.all(unique.map(n => fetchIcon(n)));
}

/**
 * Get a cached SVG synchronously (returns '' if not yet loaded).
 */
export function getCachedIcon(nameOrUrl) {
  if (!nameOrUrl) return '';
  return svgCache.get(cacheKey(nameOrUrl)) || '';
}

/**
 * Clear the icon cache.
 */
export function clearCache() {
  svgCache.clear();
  pendingFetches.clear();
}

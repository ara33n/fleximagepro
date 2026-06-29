const DEFAULT_LIMIT = 500;
const REQUEST_TIMEOUT_MS = 10000;

async function generateSitemapForSite(inputUrl, options = {}) {
  const startUrl = normalizeStartUrl(inputUrl);
  const limit = clampLimit(options.limit);
  const robots = await fetchRobots(startUrl);
  const discoveredSitemap = await findExistingSitemap(startUrl, robots);

  if (discoveredSitemap) {
    return {
      source: 'existing',
      robotsFound: robots.found,
      existingSitemapUrl: discoveredSitemap.url,
      pages: discoveredSitemap.urls,
      totalPages: discoveredSitemap.urls.length,
      sitemapXml: discoveredSitemap.xml,
      limit,
    };
  }

  const pages = await crawlInternalLinks(startUrl, limit);
  return {
    source: 'generated',
    robotsFound: robots.found,
    existingSitemapUrl: null,
    pages,
    totalPages: pages.length,
    sitemapXml: buildSitemapXml(pages),
    limit,
  };
}

function normalizeStartUrl(input) {
  if (!input || typeof input !== 'string') {
    throw createHttpError(400, 'Enter a valid website URL.');
  }
  const value = input.trim();
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url;
  try {
    url = new URL(withProtocol);
  } catch {
    throw createHttpError(400, 'Enter a valid website URL.');
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createHttpError(400, 'Only HTTP and HTTPS URLs are supported.');
  }
  url.hash = '';
  return normalizeUrl(url);
}

async function fetchRobots(startUrl) {
  const url = new URL('/robots.txt', startUrl);
  try {
    const response = await fetchWithTimeout(url.href);
    if (!response.ok) return { found: false, text: '', sitemapUrls: [] };
    const text = await response.text();
    return {
      found: true,
      text,
      sitemapUrls: text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => /^sitemap:/i.test(line))
        .map((line) => line.replace(/^sitemap:/i, '').trim())
        .filter(Boolean),
    };
  } catch {
    return { found: false, text: '', sitemapUrls: [] };
  }
}

async function findExistingSitemap(startUrl, robots) {
  const candidates = [
    ...robots.sitemapUrls,
    new URL('/sitemap.xml', startUrl).href,
  ];
  for (const candidate of unique(candidates)) {
    try {
      const response = await fetchWithTimeout(candidate);
      if (!response.ok) continue;
      const xml = await response.text();
      if (!/<(?:urlset|sitemapindex)\b/i.test(xml)) continue;
      const urls = extractLocUrls(xml);
      return {
        url: candidate,
        xml,
        urls,
      };
    } catch {
      continue;
    }
  }
  return null;
}

async function crawlInternalLinks(startUrl, limit) {
  const origin = new URL(startUrl).origin;
  const queue = [startUrl];
  const queued = new Set(queue);
  const visited = new Set();
  const pages = [];

  while (queue.length && pages.length < limit) {
    const current = queue.shift();
    if (!current || visited.has(current)) continue;
    visited.add(current);
    let html = '';
    try {
      const response = await fetchWithTimeout(current);
      const type = response.headers.get('content-type') || '';
      if (!response.ok || !type.toLowerCase().includes('text/html')) continue;
      html = await response.text();
    } catch {
      continue;
    }

    pages.push(current);
    for (const href of extractLinks(html)) {
      const next = resolveInternalUrl(href, current, origin);
      if (!next || queued.has(next) || visited.has(next)) continue;
      queued.add(next);
      queue.push(next);
      if (queued.size >= limit * 2) break;
    }
  }

  return pages.sort((a, b) => a.localeCompare(b));
}

function extractLinks(html) {
  const links = [];
  const pattern = /<a\b[^>]*\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  let match;
  while ((match = pattern.exec(html))) {
    links.push(match[1] || match[2] || match[3] || '');
  }
  return links;
}

function resolveInternalUrl(href, baseUrl, origin) {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('#')) return null;
  if (/^(mailto:|tel:|javascript:)/i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    return null;
  }
  if (url.origin !== origin) return null;
  if (!['http:', 'https:'].includes(url.protocol)) return null;
  if (/\.(?:jpg|jpeg|png|gif|webp|avif|svg|pdf|zip|mp4|mp3|css|js|ico|xml)$/i.test(url.pathname)) return null;
  url.hash = '';
  return normalizeUrl(url);
}

function normalizeUrl(value) {
  const url = value instanceof URL ? value : new URL(value);
  url.hash = '';
  if (url.pathname !== '/' && url.pathname.endsWith('/')) {
    url.pathname = url.pathname.replace(/\/+$/, '');
  }
  return url.href;
}

function buildSitemapXml(urls) {
  const today = new Date().toISOString().slice(0, 10);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => [
      '  <url>',
      `    <loc>${escapeXml(url)}</loc>`,
      `    <lastmod>${today}</lastmod>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
  ].join('\n');
}

function extractLocUrls(xml) {
  const urls = [];
  const pattern = /<loc>\s*([^<]+?)\s*<\/loc>/gi;
  let match;
  while ((match = pattern.exec(xml))) {
    urls.push(match[1].trim());
  }
  return unique(urls);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'user-agent': 'FlexImagePro Sitemap Generator',
        accept: 'text/html,application/xml,text/xml;q=0.9,*/*;q=0.8',
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

function clampLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(DEFAULT_LIMIT, Math.round(numeric)));
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

module.exports = {
  buildSitemapXml,
  generateSitemapForSite,
};

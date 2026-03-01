/**
 * ARIA v4.0 — Web Scraper Tool
 * Reads and extracts clean text from any public URL
 */

const CORS_PROXIES = [
  (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
  (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
];

/**
 * Scrape a web page and return clean text
 */
export async function scrapeWebPage({ url, maxChars = 8000 }) {
  if (!url?.startsWith('http')) return { error: 'Invalid URL' };

  // Try direct fetch first (server-side, no CORS issues)
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ARIABot/4.0)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const html = await res.text();
      const text = extractText(html, maxChars);
      return { url, text, chars: text.length };
    }
  } catch (e) {
    // Server fetch failed, try proxy
  }

  // Try CORS proxies as fallback
  for (const proxyFn of CORS_PROXIES) {
    try {
      const res = await fetch(proxyFn(url), {
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const html = data.contents || data;
      if (!html) continue;

      const text = extractText(typeof html === 'string' ? html : JSON.stringify(html), maxChars);
      return { url, text, chars: text.length };

    } catch (e) {
      continue;
    }
  }

  return { error: `Could not fetch: ${url}` };
}

/**
 * Extract clean readable text from HTML
 */
function extractText(html, maxChars = 8000) {
  return html
    // Remove scripts, styles, nav, footer
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[\s\S]*?<\/header>/gi, '')
    // Convert block elements to newlines
    .replace(/<(p|div|h[1-6]|li|br|tr)[^>]*>/gi, '\n')
    // Remove remaining tags
    .replace(/<[^>]+>/g, '')
    // Decode entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    // Clean whitespace
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, maxChars);
}

/**
 * Fetch GitHub raw file content
 */
export async function fetchGithubRaw({ owner, repo, path, branch = 'main' }) {
  const url = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
  return scrapeWebPage({ url, maxChars: 20000 });
}

/**
 * Read npm package docs
 */
export async function fetchNpmDocs({ packageName }) {
  const url = `https://www.npmjs.com/package/${packageName}`;
  return scrapeWebPage({ url, maxChars: 5000 });
}

/**
 * ARIA v4.0 — Web Search Tool
 * Primary: Serper (2500 free/month)
 * Fallback: DuckDuckGo (unlimited, no key)
 */

import { markSuccess, markFailed, getSearchProvider } from './fallback.js';

const SERPER_KEY = process.env.SERPER_API_KEY;

/**
 * Search the web — auto-selects best available provider
 */
export async function webSearch({ query, numResults = 8 }) {
  const provider = getSearchProvider();
  if (!provider) return { error: 'All search providers unavailable' };

  if (provider === 'serper') return serperSearch({ query, numResults });
  return duckduckgoSearch({ query, numResults });
}

/**
 * Serper Google Search API
 */
async function serperSearch({ query, numResults = 8 }) {
  if (!SERPER_KEY) {
    markFailed('serper', 'No API key');
    return duckduckgoSearch({ query, numResults });
  }

  try {
    const res = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': SERPER_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ q: query, num: numResults }),
    });

    if (!res.ok) {
      markFailed('serper', `HTTP ${res.status}`);
      return duckduckgoSearch({ query, numResults });
    }

    const data = await res.json();
    markSuccess('serper');

    const results = [];

    // Featured snippet
    if (data.answerBox?.answer) {
      results.push({ type: 'answer', text: data.answerBox.answer });
    }

    // Organic results
    (data.organic || []).slice(0, numResults).forEach(r => {
      results.push({
        type: 'organic',
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        date: r.date || '',
      });
    });

    return { results, provider: 'serper', query };

  } catch (e) {
    markFailed('serper', e.message);
    return duckduckgoSearch({ query, numResults });
  }
}

/**
 * DuckDuckGo instant search (no API key needed)
 */
async function duckduckgoSearch({ query, numResults = 8 }) {
  try {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
    const res = await fetch(url);

    if (!res.ok) {
      markFailed('duckduckgo', `HTTP ${res.status}`);
      return { error: 'All search providers failed', query };
    }

    const data = await res.json();
    markSuccess('duckduckgo');

    const results = [];

    if (data.AbstractText) {
      results.push({ type: 'answer', text: data.AbstractText, source: data.AbstractSource });
    }

    (data.RelatedTopics || []).slice(0, numResults).forEach(t => {
      if (t.Text && t.FirstURL) {
        results.push({ type: 'organic', title: t.Text.slice(0, 80), url: t.FirstURL, snippet: t.Text });
      }
    });

    // Fallback: return a Google search URL if no results
    if (!results.length) {
      return {
        results: [{ type: 'info', text: `No instant results. Try: https://google.com/search?q=${encodeURIComponent(query)}` }],
        provider: 'duckduckgo',
        query,
      };
    }

    return { results, provider: 'duckduckgo', query };

  } catch (e) {
    markFailed('duckduckgo', e.message);
    return { error: `Search error: ${e.message}`, query };
  }
}

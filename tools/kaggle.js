/**
 * ARIA v4.0 — Kaggle Tool
 * Dataset search, download metadata, and GPU notebook management
 * Free tier: 30 hrs GPU/week
 */

import { markSuccess, markFailed } from './fallback.js';

const KAGGLE_USER = process.env.KAGGLE_USERNAME;
const KAGGLE_KEY  = process.env.KAGGLE_KEY;
const BASE_URL    = 'https://www.kaggle.com/api/v1';

function authHeader() {
  const creds = Buffer.from(`${KAGGLE_USER}:${KAGGLE_KEY}`).toString('base64');
  return { 'Authorization': `Basic ${creds}`, 'Content-Type': 'application/json' };
}

/**
 * Search for datasets on Kaggle
 */
export async function kaggleSearch({ query, maxResults = 10, fileType = '' }) {
  if (!KAGGLE_USER || !KAGGLE_KEY) return { error: 'Kaggle credentials not set' };

  try {
    const params = new URLSearchParams({ search: query, pageSize: maxResults });
    if (fileType) params.set('fileType', fileType);

    const res = await fetch(`${BASE_URL}/datasets/list?${params}`, {
      headers: authHeader(),
    });

    if (!res.ok) {
      markFailed('kaggle', `HTTP ${res.status}`);
      return { error: `Kaggle search error: ${res.status}` };
    }

    const data = await res.json();
    markSuccess('kaggle');

    const results = (data || []).slice(0, maxResults).map(d => ({
      ref: d.ref,
      title: d.title,
      subtitle: d.subtitle,
      size: d.totalBytes ? `${(d.totalBytes / 1024 / 1024).toFixed(1)} MB` : 'unknown',
      lastUpdated: d.lastUpdated,
      downloadCount: d.downloadCount,
      voteCount: d.voteCount,
      url: `https://www.kaggle.com/datasets/${d.ref}`,
    }));

    return { results, total: results.length };

  } catch (e) {
    markFailed('kaggle', e.message);
    return { error: `Kaggle search error: ${e.message}` };
  }
}

/**
 * Get dataset details
 */
export async function kaggleDatasetInfo({ datasetRef }) {
  if (!KAGGLE_USER || !KAGGLE_KEY) return { error: 'Kaggle credentials not set' };

  try {
    const [owner, dataset] = datasetRef.split('/');
    const res = await fetch(`${BASE_URL}/datasets/${owner}/${dataset}`, {
      headers: authHeader(),
    });

    if (!res.ok) return { error: `Kaggle info error: ${res.status}` };

    const data = await res.json();
    markSuccess('kaggle');

    return {
      ref: data.ref,
      title: data.title,
      description: data.description?.slice(0, 500),
      size: `${(data.totalBytes / 1024 / 1024).toFixed(1)} MB`,
      files: data.files?.map(f => ({ name: f.name, size: f.totalBytes })) || [],
      url: `https://www.kaggle.com/datasets/${data.ref}`,
      downloadCommand: `kaggle datasets download -d ${datasetRef}`,
    };

  } catch (e) {
    markFailed('kaggle', e.message);
    return { error: `Kaggle info error: ${e.message}` };
  }
}

/**
 * List user's notebooks/kernels
 */
export async function kaggleListNotebooks() {
  if (!KAGGLE_USER || !KAGGLE_KEY) return { error: 'Kaggle credentials not set' };

  try {
    const res = await fetch(`${BASE_URL}/kernels/list?mine=true&pageSize=20`, {
      headers: authHeader(),
    });

    if (!res.ok) return { error: `Kaggle notebooks error: ${res.status}` };

    const data = await res.json();
    markSuccess('kaggle');

    return {
      notebooks: (data || []).map(k => ({
        ref: k.ref,
        title: k.title,
        language: k.language,
        totalVotes: k.totalVotes,
        url: `https://www.kaggle.com/code/${k.ref}`,
        lastRunTime: k.lastRunTime,
      })),
    };

  } catch (e) {
    markFailed('kaggle', e.message);
    return { error: `Kaggle notebooks error: ${e.message}` };
  }
}

/**
 * Get GPU usage status (free tier: 30hrs/week)
 */
export async function kaggleGPUStatus() {
  // Kaggle doesn't expose quota via API directly
  // We return a helpful message with the web URL
  return {
    message: 'Check GPU quota at https://www.kaggle.com/settings/account',
    freeQuota: '30 hrs/week (T4 GPU)',
    tip: 'Use Kaggle notebooks for heavy ML training. Results auto-save to Kaggle.',
    user: KAGGLE_USER,
  };
}

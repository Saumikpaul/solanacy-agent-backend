/**
 * ARIA v4.0 — Fallback Manager
 * Tracks service limits and auto-switches when one is exhausted
 */

const serviceState = {
  groq:        { calls: 0, errors: 0, lastError: null, available: true },
  openrouter:  { calls: 0, errors: 0, lastError: null, available: true },
  huggingface: { calls: 0, errors: 0, lastError: null, available: true },
  serper:      { calls: 0, errors: 0, lastError: null, available: true },
  duckduckgo:  { calls: 0, errors: 0, lastError: null, available: true },
  kaggle:      { calls: 0, errors: 0, lastError: null, available: true },
};

// Mark a service as failed (rate limited or error)
export function markFailed(service, reason = '') {
  if (!serviceState[service]) return;
  serviceState[service].errors++;
  serviceState[service].lastError = reason;

  // After 3 consecutive errors, mark unavailable temporarily
  if (serviceState[service].errors >= 3) {
    serviceState[service].available = false;
    console.warn(`⚠️ [Fallback] ${service} marked unavailable: ${reason}`);

    // Auto-recover after 5 minutes
    setTimeout(() => {
      serviceState[service].available = true;
      serviceState[service].errors = 0;
      console.log(`✅ [Fallback] ${service} recovered`);
    }, 5 * 60 * 1000);
  }
}

// Mark a service as successful
export function markSuccess(service) {
  if (!serviceState[service]) return;
  serviceState[service].calls++;
  serviceState[service].errors = 0;
  serviceState[service].available = true;
}

// Check if a service is available
export function isAvailable(service) {
  return serviceState[service]?.available ?? false;
}

// Get status of all services
export function getStatus() {
  return Object.entries(serviceState).map(([name, s]) => ({
    name,
    available: s.available,
    calls: s.calls,
    errors: s.errors,
    lastError: s.lastError,
  }));
}

// LLM fallback chain: Groq → OpenRouter → HuggingFace
export function getLLMProvider() {
  if (isAvailable('groq')) return 'groq';
  if (isAvailable('openrouter')) return 'openrouter';
  if (isAvailable('huggingface')) return 'huggingface';
  return null; // all down
}

// Search fallback chain: Serper → DuckDuckGo
export function getSearchProvider() {
  if (isAvailable('serper')) return 'serper';
  if (isAvailable('duckduckgo')) return 'duckduckgo';
  return null;
}

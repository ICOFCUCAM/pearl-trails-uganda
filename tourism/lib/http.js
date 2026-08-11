/**
 * The one HTTP entry point the providers use.
 *
 * Kept separate so tests can swap it wholesale (see tests/*.test.mjs) without
 * monkey-patching globalThis.fetch, and so retry/backoff and rate-limit
 * handling live in exactly one place.
 */

/** Errors that carry an HTTP status, so callers can branch on 401 vs 429. */
export class HttpError extends Error {
  constructor(message, { status, provider, retryable = false } = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.provider = provider;
    this.retryable = retryable;
  }
}

const DEFAULT_RETRIES = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * GET JSON with bounded exponential backoff.
 *
 * @param {string} url
 * @param {{headers?: Record<string,string>, provider?: string, retries?: number,
 *          timeoutMs?: number, fetchImpl?: typeof fetch, onRetry?: Function}} opts
 */
export async function getJson(url, opts = {}) {
  const {
    headers = {},
    provider = 'unknown',
    retries = DEFAULT_RETRIES,
    timeoutMs = 20000,
    fetchImpl = globalThis.fetch,
    onRetry,
  } = opts;

  if (typeof fetchImpl !== 'function') {
    throw new HttpError('No fetch implementation available', { provider });
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(url, {
        headers: { Accept: 'application/json', ...headers },
        signal: controller.signal,
      });

      if (response.ok) return await response.json();

      // 401/403 are credential problems: retrying cannot fix them.
      const retryable = response.status === 429 || response.status >= 500;
      const error = new HttpError(
        `${provider} responded ${response.status}`,
        { status: response.status, provider, retryable },
      );
      if (!retryable || attempt === retries) throw error;
      lastError = error;
    } catch (error) {
      if (error instanceof HttpError && !error.retryable) throw error;
      lastError = error;
      if (attempt === retries) break;
    } finally {
      clearTimeout(timer);
    }

    const waitMs = 2 ** attempt * 1000;
    if (onRetry) onRetry({ attempt: attempt + 1, waitMs, error: lastError });
    await sleep(waitMs);
  }

  throw lastError instanceof Error
    ? lastError
    : new HttpError(`${provider} request failed`, { provider });
}

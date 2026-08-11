/**
 * Pexels — the fallback provider, used only when Unsplash returns nothing that
 * clears the acceptance threshold.
 *
 * Same rule as Unsplash: every field is taken from the response. Pexels has no
 * tag array, so the ranker leans on `alt` and the photographer name instead.
 */

import { getJson, HttpError } from '../http.js';

export const PROVIDER = 'pexels';
const ENDPOINT = 'https://api.pexels.com/v1/search';

function toCandidate(photo) {
  if (!photo || typeof photo !== 'object') return null;
  const id = photo.id;
  // `src.original` is the unresized original; the size variants are derived
  // from it by the CDN helper using Pexels' own documented query parameters.
  const original = photo.src?.original;
  const sourceUrl = photo.url;
  const width = Number(photo.width);
  const height = Number(photo.height);

  if (!id || !original || !sourceUrl) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return null;
  }
  if (!/^https:\/\/images\.pexels\.com\//.test(original)) return null;

  return {
    provider: PROVIDER,
    photoId: String(id),
    baseUrl: original,
    thumbnailUrl: photo.src?.tiny ?? photo.src?.small ?? null,
    sourceUrl,
    downloadLocation: null,
    photographer: photo.photographer ?? 'Unknown',
    photographerUrl: photo.photographer_url ?? null,
    width,
    height,
    description: photo.alt ?? '',
    tags: [],
    likes: 0,
    color: photo.avg_color ?? null,
  };
}

/**
 * @param {{query: string, orientation?: 'landscape'|'portrait'|'square',
 *          perPage?: number, apiKey: string, fetchImpl?: typeof fetch}} opts
 */
export async function search({
  query,
  orientation = 'landscape',
  perPage = 24,
  apiKey,
  fetchImpl,
}) {
  if (!apiKey) {
    throw new HttpError('PEXELS_API_KEY is not set', {
      provider: PROVIDER,
      status: 401,
    });
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(perPage));
  // Pexels calls it "square"; Unsplash calls it "squarish".
  url.searchParams.set(
    'orientation',
    orientation === 'squarish' ? 'square' : orientation,
  );

  const body = await getJson(url.toString(), {
    provider: PROVIDER,
    fetchImpl,
    headers: { Authorization: apiKey },
  });

  const results = Array.isArray(body?.photos) ? body.photos : [];
  return results.map(toCandidate).filter(Boolean);
}

export const __test__ = { toCandidate };

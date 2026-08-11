/**
 * Unsplash — the primary provider.
 *
 * Every field of the candidate comes out of the API response. Nothing is
 * constructed: the image URL is `urls.raw` as returned, the id is `id` as
 * returned, and the page link is `links.html` as returned. If a response is
 * missing any of those, the candidate is dropped rather than patched, because a
 * patched URL is a fabricated URL.
 */

import { getJson, HttpError } from '../http.js';

export const PROVIDER = 'unsplash';
const ENDPOINT = 'https://api.unsplash.com/search/photos';

/**
 * Unsplash requires attribution and a download-tracking ping. We keep the
 * `links.download_location` so a deployment that wants to honour the trigger
 * has it, and we always record photographer + profile URL.
 */
function toCandidate(photo) {
  if (!photo || typeof photo !== 'object') return null;
  const id = photo.id;
  const rawUrl = photo.urls?.raw;
  const sourceUrl = photo.links?.html;
  const width = Number(photo.width);
  const height = Number(photo.height);

  // No id, no base URL, no page link, or no dimensions -> unusable. Never
  // synthesise the missing half.
  if (!id || !rawUrl || !sourceUrl) return null;
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) {
    return null;
  }
  if (!/^https:\/\/images\.unsplash\.com\//.test(rawUrl)) return null;

  return {
    provider: PROVIDER,
    photoId: String(id),
    baseUrl: rawUrl,
    thumbnailUrl: photo.urls?.thumb ?? null,
    sourceUrl,
    downloadLocation: photo.links?.download_location ?? null,
    photographer: photo.user?.name ?? photo.user?.username ?? 'Unknown',
    photographerUrl: photo.user?.links?.html ?? null,
    width,
    height,
    description: photo.description ?? photo.alt_description ?? '',
    tags: (photo.tags ?? [])
      .map((t) => (typeof t === 'string' ? t : t?.title))
      .filter(Boolean),
    likes: Number(photo.likes) || 0,
    color: photo.color ?? null,
  };
}

/**
 * @param {{query: string, orientation?: 'landscape'|'portrait'|'squarish',
 *          perPage?: number, accessKey: string, fetchImpl?: typeof fetch}} opts
 * @returns {Promise<Array<object>>}
 */
export async function search({
  query,
  orientation = 'landscape',
  perPage = 24,
  accessKey,
  fetchImpl,
}) {
  if (!accessKey) {
    throw new HttpError('UNSPLASH_ACCESS_KEY is not set', {
      provider: PROVIDER,
      status: 401,
    });
  }

  const url = new URL(ENDPOINT);
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', String(perPage));
  url.searchParams.set('orientation', orientation);
  url.searchParams.set('content_filter', 'high');

  const body = await getJson(url.toString(), {
    provider: PROVIDER,
    fetchImpl,
    headers: {
      Authorization: `Client-ID ${accessKey}`,
      'Accept-Version': 'v1',
    },
  });

  const results = Array.isArray(body?.results) ? body.results : [];
  return results.map(toCandidate).filter(Boolean);
}

export const __test__ = { toCandidate };

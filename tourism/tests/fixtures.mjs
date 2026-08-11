/**
 * Mock provider responses. Shaped exactly like the real API payloads so the
 * provider modules are exercised, not bypassed. No test in this suite ever
 * needs a real credential or a network connection.
 */

export function unsplashPhoto(overrides = {}) {
  return {
    id: 'AbCd1234xyz',
    width: 5000,
    height: 3333,
    color: '#26261e',
    likes: 640,
    description: 'Mountain gorilla in Bwindi Impenetrable Forest, Uganda',
    alt_description: 'gorilla in forest',
    urls: {
      raw: 'https://images.unsplash.com/photo-mock-uganda-gorilla',
      thumb: 'https://images.unsplash.com/photo-mock-uganda-gorilla?w=200',
    },
    links: {
      html: 'https://unsplash.com/photos/AbCd1234xyz',
      download_location: 'https://api.unsplash.com/photos/AbCd1234xyz/download',
    },
    user: {
      name: 'A Photographer',
      username: 'aphotographer',
      links: { html: 'https://unsplash.com/@aphotographer' },
    },
    tags: [{ title: 'uganda' }, { title: 'bwindi' }, { title: 'gorilla' }, { title: 'wildlife' }],
    ...overrides,
  };
}

export function pexelsPhoto(overrides = {}) {
  return {
    id: 998877,
    width: 4200,
    height: 2800,
    url: 'https://www.pexels.com/photo/mock-998877/',
    photographer: 'Another Photographer',
    photographer_url: 'https://www.pexels.com/@another',
    avg_color: '#3a4a3a',
    alt: 'Mountain gorilla resting in the Bwindi rainforest in Uganda',
    src: {
      original: 'https://images.pexels.com/photos/998877/mock.jpeg',
      tiny: 'https://images.pexels.com/photos/998877/mock.jpeg?w=100',
    },
    ...overrides,
  };
}

/**
 * A fetch stand-in. `routes` maps a substring of the URL to either a payload
 * object or `{status}` for an error response.
 */
export function mockFetch(routes) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url: String(url), init });
    for (const [needle, response] of Object.entries(routes)) {
      if (!String(url).includes(needle)) continue;
      if (typeof response === 'function') return response(String(url), init);
      if (response && typeof response.status === 'number' && !response.body) {
        return {
          ok: false,
          status: response.status,
          json: async () => ({}),
        };
      }
      return { ok: true, status: 200, json: async () => response };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  impl.calls = calls;
  return impl;
}

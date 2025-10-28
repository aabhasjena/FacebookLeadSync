

const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export async function request(path, opts = {}) {
  const url = `${BASE}${path}`;

  // merge headers
  const headers = {
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };

  // make request
  const res = await fetch(url, {
    ...opts,
    headers,
  });

  // handle non-OK responses
  if (!res.ok) {
    let errMsg = `Request failed: ${res.status}`;
    try {
      const text = await res.text();
      const json = JSON.parse(text);
      errMsg = json?.message || json?.error || text;
    } catch {
      // ignore JSON parse error
    }
    throw new Error(errMsg);
  }

  // try to parse JSON safely
  try {
    return await res.json();
  } catch {
    return null; // empty response (e.g., 204 No Content)
  }
}

export { BASE };

export const NGUONC_API_BASE = '/api/movies';

export async function fetchNguoncJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${NGUONC_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(`Nguonc API HTTP ${response.status}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Nguonc API returned ${contentType || 'non-JSON response'}`);
  }

  return response.json();
}

export function getNguoncItems(data) {
  const items =
    data?.items ||
    data?.data?.items ||
    data?.data?.data ||
    data?.data?.movies ||
    data?.movies ||
    data?.result?.items ||
    data?.data ||
    [];
  return Array.isArray(items) ? items : [];
}

export function isNguoncSuccess(data) {
  return data?.status === 'success' || data?.success === true || getNguoncItems(data).length > 0;
}

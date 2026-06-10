export const NGUONC_API_BASE = '/api/movies';

export async function fetchNguoncJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${NGUONC_API_BASE}${endpoint}`;
  const response = await fetch(url, options);
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
  const items = data?.items || data?.data?.items || data?.data || [];
  return Array.isArray(items) ? items : [];
}

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

export function getNguoncPagination(data) {
  const pagination = data?.paginate || data?.data?.paginate || data?.data?.params?.pagination;
  if (!pagination) return null;
  return {
    currentPage: Number(pagination.current_page ?? pagination.currentPage ?? 1),
    totalPages: Number(pagination.total_page ?? Math.ceil(pagination.totalItems / pagination.totalItemsPerPage) ?? 1),
    totalItems: Number(pagination.total_items ?? pagination.totalItems ?? 0),
    itemsPerPage: Number(pagination.items_per_page ?? pagination.totalItemsPerPage ?? 0),
  };
}

export function getOPhimImageUrl(path) {
  if (!path) return '/poster.jpg';
  if (path.startsWith('http')) return path;
  return `https://img.ophim.live/uploads/movies/${path}`;
}

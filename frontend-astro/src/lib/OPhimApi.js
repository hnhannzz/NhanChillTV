export const OPHIM_API_BASE = '/api/movies';

export async function fetchOPhimJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${OPHIM_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(`OPhim API HTTP ${response.status}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`OPhim API returned ${contentType || 'non-JSON response'}`);
  }

  return response.json();
}

export function getOPhimItems(data) {
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

export function isOPhimSuccess(data) {
  return data?.status === 'success' || data?.status === true || data?.success === true || getOPhimItems(data).length > 0;
}

export function getOPhimPagination(data) {
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
  
  let cleanedPath = path;
  if (cleanedPath.startsWith('/')) {
    cleanedPath = cleanedPath.substring(1);
  }
  if (cleanedPath.startsWith('uploads/movies/')) {
    cleanedPath = cleanedPath.replace('uploads/movies/', '');
  }
  
  return `https://img.ophim.live/uploads/movies/${cleanedPath}`;
}

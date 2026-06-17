export const MOVIE_API_BASE = '/api/movies';
export const OPHIM_API_BASE = MOVIE_API_BASE;

export async function fetchMovieJson(endpoint, options = {}) {
  const url = endpoint.startsWith('http') ? endpoint : `${MOVIE_API_BASE}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    throw new Error(`Movie API HTTP ${response.status}`);
  }

  if (!contentType.includes('application/json')) {
    throw new Error(`Movie API returned ${contentType || 'non-JSON response'}`);
  }

  return response.json();
}

export function getMovieItems(data) {
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

export function isMovieSuccess(data) {
  return data?.status === 'success' || data?.status === true || data?.success === true || getMovieItems(data).length > 0;
}

export function getMoviePagination(data) {
  const pagination = data?.pagination || data?.paginate || data?.data?.paginate || data?.data?.params?.pagination;
  if (!pagination) return null;
  const currentPage = Number(pagination.current_page ?? pagination.currentPage ?? 1);
  const totalItems = Number(pagination.total_items ?? pagination.totalItems ?? 0);
  const itemsPerPage = Number(pagination.items_per_page ?? pagination.totalItemsPerPage ?? 0);
  const totalPages = Number(pagination.total_page ?? pagination.totalPages ?? (itemsPerPage ? Math.ceil(totalItems / itemsPerPage) : 1));
  return {
    currentPage: Number.isFinite(currentPage) && currentPage > 0 ? currentPage : 1,
    totalPages: Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1,
    totalItems: Number.isFinite(totalItems) ? totalItems : 0,
    itemsPerPage: Number.isFinite(itemsPerPage) ? itemsPerPage : 0,
  };
}

function normalizeAbsoluteImageUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  let cleanedPath = path;
  if (cleanedPath.startsWith('/')) cleanedPath = cleanedPath.substring(1);
  if (cleanedPath.startsWith('uploads/movies/')) return `https://img.ophim.live/${cleanedPath}`;
  return `https://phimimg.com/${cleanedPath}`;
}

export function getMovieImageUrl(path) {
  if (!path) return '/poster.jpg';
  if (path.startsWith('/poster') || path.startsWith('/logo') || path.startsWith('/api/movies/image')) return path;
  const absoluteUrl = normalizeAbsoluteImageUrl(path);
  return absoluteUrl ? `${MOVIE_API_BASE}/image?url=${encodeURIComponent(absoluteUrl)}` : '/poster.jpg';
}

export const fetchOPhimJson = fetchMovieJson;
export const getOPhimItems = getMovieItems;
export const isOPhimSuccess = isMovieSuccess;
export const getOPhimPagination = getMoviePagination;
export const getOPhimImageUrl = getMovieImageUrl;

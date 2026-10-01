const BASE = import.meta.env.VITE_API_URL || '';

export class ApiClientError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('a2_token');
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new ApiClientError('No hay conexión con el servidor', 0);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      localStorage.removeItem('a2_token');
      localStorage.removeItem('a2_user');
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    throw new ApiClientError(data.error || `Error ${res.status}`, res.status);
  }
  return data;
}

export const get = (path, opts) => api(path, opts);
export const post = (path, body, opts) => api(path, { ...opts, method: 'POST', body });
export const patch = (path, body, opts) => api(path, { ...opts, method: 'PATCH', body });

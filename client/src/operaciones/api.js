const BASE = import.meta.env.VITE_API_URL || '';
export const OPS_TOKEN_KEY = 'a2_ops_token';
export const OPS_USER_KEY = 'a2_ops_user';

export class OpsApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function opsApi(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem(OPS_TOKEN_KEY);
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new OpsApiError('No hay conexión con el servidor', 0);
  }

  let data = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (res.status === 401 && auth) {
      localStorage.removeItem(OPS_TOKEN_KEY);
      localStorage.removeItem(OPS_USER_KEY);
      if (!window.location.pathname.startsWith('/operaciones/login')) {
        window.location.href = '/operaciones/login';
      }
    }
    throw new OpsApiError(data.error || `Error ${res.status}`, res.status);
  }

  return data;
}

export const opsGet = (path, opts) => opsApi(path, opts);
export const opsPost = (path, body, opts) =>
  opsApi(path, { ...opts, method: 'POST', body });
export const opsPatch = (path, body, opts) =>
  opsApi(path, { ...opts, method: 'PATCH', body });

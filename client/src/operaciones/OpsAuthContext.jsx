import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { opsApi, OPS_TOKEN_KEY, OPS_USER_KEY } from './api.js';

const OpsAuthContext = createContext(null);

export function OpsAuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(OPS_USER_KEY)) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(OPS_TOKEN_KEY)));

  useEffect(() => {
    const token = localStorage.getItem(OPS_TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    opsApi('/api/operaciones/auth/me')
      .then((data) => {
        setUser(data.user);
        localStorage.setItem(OPS_USER_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem(OPS_TOKEN_KEY);
        localStorage.removeItem(OPS_USER_KEY);
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(usuario, password) {
        const data = await opsApi('/api/operaciones/auth/login', {
          method: 'POST',
          body: { usuario, password },
          auth: false
        });
        localStorage.setItem(OPS_TOKEN_KEY, data.token);
        localStorage.setItem(OPS_USER_KEY, JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
      },
      logout() {
        localStorage.removeItem(OPS_TOKEN_KEY);
        localStorage.removeItem(OPS_USER_KEY);
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <OpsAuthContext.Provider value={value}>{children}</OpsAuthContext.Provider>;
}

export const useOpsAuth = () => useContext(OpsAuthContext);

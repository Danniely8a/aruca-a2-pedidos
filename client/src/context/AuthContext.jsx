import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('a2_user')) || null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(Boolean(localStorage.getItem('a2_token')));

  useEffect(() => {
    const token = localStorage.getItem('a2_token');
    if (!token) return;
    api('/api/auth/me')
      .then((data) => {
        setUser(data.user);
        localStorage.setItem('a2_user', JSON.stringify(data.user));
      })
      .catch(() => {
        setUser(null);
        localStorage.removeItem('a2_token');
        localStorage.removeItem('a2_user');
      })
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      async login(usuario, password) {
        const data = await api('/api/auth/login', {
          method: 'POST',
          body: { usuario, password },
          auth: false
        });
        localStorage.setItem('a2_token', data.token);
        localStorage.setItem('a2_user', JSON.stringify(data.user));
        setUser(data.user);
        return data.user;
      },
      logout() {
        localStorage.removeItem('a2_token');
        localStorage.removeItem('a2_user');
        setUser(null);
      }
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);

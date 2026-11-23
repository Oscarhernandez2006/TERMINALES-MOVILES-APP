import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, loadApiUrl, setAuthToken, setUnauthorizedHandler } from '@/lib/api';
import { storage } from '@/lib/storage';

export interface AuthUser {
  id: string;
  fullName: string;
  documentId: string | null;
  role: string;
  accesoTotal?: boolean;
  modulos?: string[];
  plant?: { id: string; code: string; legalName: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  checkCedula: (documentId: string) => Promise<{ exists: boolean; fullName: string | null }>;
  login: (documentId: string, pin: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const TOKEN_KEY = 'frigo_token';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    await storage.remove(TOKEN_KEY);
    setAuthToken(null);
    setUser(null);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => void logout());
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  // Carga el servidor configurado y restaura la sesión validando el token contra /auth/me.
  useEffect(() => {
    (async () => {
      try {
        await loadApiUrl();
        const token = await storage.get(TOKEN_KEY);
        if (!token) return;
        setAuthToken(token);
        const { data } = await api.get<AuthUser>('/auth/me');
        setUser(data);
      } catch {
        await logout();
      } finally {
        setLoading(false);
      }
    })();
  }, [logout]);

  const login = useCallback(async (documentId: string, pin: string) => {
    const { data } = await api.post<{ accessToken: string; user: AuthUser }>('/auth/login', {
      documentId,
      pin,
    });
    await storage.set(TOKEN_KEY, data.accessToken);
    setAuthToken(data.accessToken);
    try {
      const me = await api.get<AuthUser>('/auth/me');
      setUser({ ...data.user, ...me.data });
    } catch {
      setUser(data.user);
    }
  }, []);

  const checkCedula = useCallback(async (documentId: string) => {
    const { data } = await api.post<{ exists: boolean; fullName: string | null }>(
      '/auth/check-cedula',
      { documentId },
    );
    return data;
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await api.get<AuthUser>('/auth/me');
    setUser(data);
  }, []);

  const value = useMemo(
    () => ({ user, loading, checkCedula, login, logout, refreshUser }),
    [user, loading, checkCedula, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

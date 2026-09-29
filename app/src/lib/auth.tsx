import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api, setUnauthorizedHandler, tokens } from './api';
import type { Tokens, User } from './types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  reload: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  const reload = useCallback(async () => {
    try {
      setUser(await api.get<User>('/auth/me'));
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    (async () => {
      if (await tokens.access()) await reload();
      setLoading(false);
    })();
  }, [reload]);

  const login = useCallback(
    async (email: string, password: string) => {
      const t = await api.post<Tokens>('/auth/login', { email, password });
      await tokens.save(t);
      qc.clear();
      await reload();
    },
    [qc, reload],
  );

  const logout = useCallback(async () => {
    await tokens.clear();
    qc.clear();
    setUser(null);
  }, [qc]);

  const value = useMemo(() => ({ user, loading, login, logout, reload }), [user, loading, login, logout, reload]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}

/** Usuario autenticado (las pantallas internas solo se muestran con sesión). */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('Sin sesión');
  return user;
}

export const isOrgPublisher = (u: User) => u.role === 'empresa' || u.role === 'gobierno' || u.role === 'admin';
export const isAcademic = (u: User) => u.role === 'estudiante' || u.role === 'academico';

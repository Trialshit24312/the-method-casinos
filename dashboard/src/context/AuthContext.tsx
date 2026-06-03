import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '../api';
import type { User } from '../types';

const USER_CACHE_KEY = 'method.auth.user';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

function readCachedUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

function writeCachedUser(user: User | null): void {
  try {
    if (!user) {
      localStorage.removeItem(USER_CACHE_KEY);
      return;
    }
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));
  } catch {
    /* ignore quota / private mode */
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(() => readCachedUser());
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user: u } = await api.getMe();
      setUser(u);
      writeCachedUser(u);
    } catch {
      if (!readCachedUser()) {
        setUser(null);
        writeCachedUser(null);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = async () => {
    await api.logout();
    setUser(null);
    writeCachedUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

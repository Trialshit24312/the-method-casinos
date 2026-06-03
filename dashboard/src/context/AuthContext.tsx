import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { api } from '../api';
import type { User } from '../types';
import { mergeGuestFavoritesIntoAccount, readGuestFavorites } from '../lib/guest-favorites';

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
    const cached = readCachedUser();
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const { user: u } = await api.getMe();
        setUser(u);
        writeCachedUser(u);
        if (u && readGuestFavorites().length > 0) {
          void mergeGuestFavoritesIntoAccount((id) => api.addFavorite(id));
        }
        setLoading(false);
        return;
      } catch {
        if (attempt < 3) {
          await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
          continue;
        }
        if (!cached) {
          setUser(null);
          writeCachedUser(null);
        }
      }
    }
    setLoading(false);
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

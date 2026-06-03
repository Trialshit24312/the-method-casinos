import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import { readGuestFavorites, toggleGuestFavorite } from '../lib/guest-favorites';
import type { Casino } from '../types';

export function useCasinoFavorites() {
  const { user } = useAuth();
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [guestFavoriteIds, setGuestFavoriteIds] = useState(
    () => new Set(readGuestFavorites().map((c) => c.id)),
  );

  useEffect(() => {
    if (!user) {
      setFavoriteIds(new Set());
      return;
    }
    api.getFavorites()
      .then((favs) => setFavoriteIds(new Set(favs.map((f) => f.casino.id))))
      .catch(() => setFavoriteIds(new Set()));
  }, [user]);

  useEffect(() => {
    const refresh = () => setGuestFavoriteIds(new Set(readGuestFavorites().map((c) => c.id)));
    window.addEventListener('method-guest-favorites', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('method-guest-favorites', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const isFavorited = useCallback(
    (casinoId: string) => (user ? favoriteIds.has(casinoId) : guestFavoriteIds.has(casinoId)),
    [user, favoriteIds, guestFavoriteIds],
  );

  const toggleFavorite = useCallback(
    async (casino: Casino): Promise<boolean> => {
      if (user) {
        const wasFavorited = favoriteIds.has(casino.id);
        if (wasFavorited) {
          await api.removeFavorite(casino.id);
          setFavoriteIds((prev) => {
            const next = new Set(prev);
            next.delete(casino.id);
            return next;
          });
          return false;
        }
        await api.addFavorite(casino.id);
        setFavoriteIds((prev) => new Set(prev).add(casino.id));
        return true;
      }
      const added = toggleGuestFavorite(casino);
      setGuestFavoriteIds(new Set(readGuestFavorites().map((c) => c.id)));
      return added;
    },
    [user, favoriteIds],
  );

  const favoriteCount = user ? favoriteIds.size : guestFavoriteIds.size;

  return { isFavorited, toggleFavorite, favoriteCount };
}

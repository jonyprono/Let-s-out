import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { type Event } from '@/features/events/api';

interface FavoritesState {
  favorites: Record<string, Event>;
  addFavorite: (event: Event) => void;
  removeFavorite: (eventId: string) => void;
  isFavorite: (eventId: string) => boolean;
}

export const useFavoritesStore = create<FavoritesState>()(
  persist(
    (set, get) => ({
      favorites: {},
      addFavorite: (event) =>
        set((state) => ({
          favorites: { ...state.favorites, [event.id]: event },
        })),
      removeFavorite: (eventId) =>
        set((state) => {
          const newFavorites = { ...state.favorites };
          delete newFavorites[eventId];
          return { favorites: newFavorites };
        }),
      isFavorite: (eventId) => !!get().favorites[eventId],
    }),
    {
      name: 'letsout-favorites',
    }
  )
);

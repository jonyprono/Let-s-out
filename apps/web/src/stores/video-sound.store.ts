import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

/**
 * Préférence son des OUT VLOGS : mémorisée pour les vlogs suivants et entre
 * les sessions. Par défaut le son est ACTIVÉ (l'ouverture d'un vlog est un
 * geste de l'utilisateur). Stockage protégé par try/catch.
 */

const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try { return window.localStorage.getItem(name) } catch { return null }
  },
  setItem: (name, value) => {
    try { window.localStorage.setItem(name, value) } catch { /* stockage indisponible */ }
  },
  removeItem: (name) => {
    try { window.localStorage.removeItem(name) } catch { /* stockage indisponible */ }
  },
}

interface VideoSoundState {
  /** Choix explicite de l'utilisateur (true = muet) */
  vlogMuted: boolean
  setVlogMuted: (muted: boolean) => void
}

export const useVideoSoundStore = create<VideoSoundState>()(
  persist(
    (set) => ({
      vlogMuted: false,
      setVlogMuted: (vlogMuted) => set({ vlogMuted }),
    }),
    {
      name: 'letsout-video-sound',
      version: 1,
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
)

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { apiClient } from '@/lib/api-client'

export interface AuthUser {
  id: string
  phone?: string
  email?: string
  role: 'USER' | 'ORGANIZER' | 'ADMIN'
  isVerified: boolean
  createdAt?: string
  profile?: {
    id: string
    username: string
    displayName: string
    bio?: string
    avatarUrl?: string
    coverUrl?: string
    city?: string
    isPublic?: boolean
    interests: string[]
    followersCount?: number
    eventsCount?: number
  }
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null // Store refresh token for mobile fallback
  user: AuthUser | null
  isLoading: boolean
  // Actions
  setAccessToken: (token: string) => void
  setRefreshToken: (token: string) => void
  setUser: (user: AuthUser) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isLoading: false,

      setAccessToken: (token) => set({ accessToken: token }),

      setRefreshToken: (token) => set({ refreshToken: token }),

      setUser: (user) => set({ user }),

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null })
        // Fire and forget — backend revokes cookie
        apiClient.post('/auth/logout').catch(() => {})
      },

      refreshUser: async () => {
        set({ isLoading: true })
        try {
          const { data } = await apiClient.get<AuthUser>('/auth/me')
          set({ user: data })
        } catch {
          set({ accessToken: null, refreshToken: null, user: null })
        } finally {
          set({ isLoading: false })
        }
      },
    }),
    {
      name: 'letsout-auth',
      storage: createJSONStorage(() => localStorage),
      // Persist both token AND user — user is still re-validated on boot via AppBootstrap
      partialize: (state) => ({ accessToken: state.accessToken, refreshToken: state.refreshToken, user: state.user }),
    },
  ),
)

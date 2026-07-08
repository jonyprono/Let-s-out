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
    updatedAt?: string
    city?: string
    country?: string
    isPublic?: boolean
    kycStatus?: string
    interests: string[]
    followersCount?: number
    eventsCount?: number
    birthDate?: string
  }
}

interface AuthState {
  accessToken: string | null
  refreshToken: string | null // Store refresh token for mobile fallback
  user: AuthUser | null
  isLoading: boolean
  isLoggingOut: boolean
  // Actions
  setAccessToken: (token: string) => void
  setRefreshToken: (token: string) => void
  setUser: (user: AuthUser) => void
  setLoggingOut: (value: boolean) => void
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
      isLoggingOut: false,

      setAccessToken: (token) => set({ accessToken: token }),

      setRefreshToken: (token) => set({ refreshToken: token }),

      setUser: (user) => set({ user }),

      setLoggingOut: (value) => set({ isLoggingOut: value }),

      logout: () => {
        set({ accessToken: null, refreshToken: null, user: null, isLoggingOut: false })
      },

      refreshUser: async () => {
        set({ isLoading: true })
        try {
          const { data } = await apiClient.get<AuthUser>('/auth/me')
          set((state) => ({
            user: {
              ...data,
              profile: data.profile
                ? {
                    ...data.profile,
                    avatarUrl: data.profile.avatarUrl ?? state.user?.profile?.avatarUrl,
                  }
                : state.user?.profile,
            },
          }))
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
      // Guard against corrupted persisted state (e.g. Firebase error objects with {code, message})
      // that would cause React error #31 when rendered
      merge: (persisted: any, current) => {
        const safe = { ...current }
        if (persisted && typeof persisted === 'object') {
          // Validate accessToken
          if (typeof persisted.accessToken === 'string') {
            safe.accessToken = persisted.accessToken
          }
          // Validate refreshToken
          if (typeof persisted.refreshToken === 'string') {
            safe.refreshToken = persisted.refreshToken
          }
          // Validate user — must have an id string, not be a Firebase error {code, message}
          if (
            persisted.user &&
            typeof persisted.user === 'object' &&
            typeof persisted.user.id === 'string' &&
            !('code' in persisted.user && 'message' in persisted.user)
          ) {
            safe.user = persisted.user
          }
        }
        return safe
      },
    },
  ),
)

/**
 * Global UserProfile context — lets any component open the UserProfileSheet
 * by simply calling openUserProfile(userId) without prop-drilling.
 *
 * Usage:
 *   const { openUserProfile } = useUserProfile()
 *   openUserProfile(someUserId)
 */
import { createContext, useContext, useState, useCallback } from 'react'
import { UserProfileSheet } from '@/features/users/components/UserProfileSheet'

interface UserProfileContextValue {
  openUserProfile: (userId: string, preview?: { displayName?: string; avatarUrl?: string | null }) => void
  closeUserProfile: () => void
}

const UserProfileContext = createContext<UserProfileContextValue>({
  openUserProfile: () => {},
  closeUserProfile: () => {},
})

export function useUserProfile() {
  return useContext(UserProfileContext)
}

export function UserProfileProvider({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = useState<{ userId: string; preview?: { displayName?: string; avatarUrl?: string | null } } | null>(null)

  const openUserProfile = useCallback((userId: string, preview?: { displayName?: string; avatarUrl?: string | null }) => {
    setTarget({ userId, preview })
  }, [])

  const closeUserProfile = useCallback(() => {
    setTarget(null)
  }, [])

  return (
    <UserProfileContext.Provider value={{ openUserProfile, closeUserProfile }}>
      {children}
      {target && (
        <UserProfileSheet
          userId={target.userId}
          preview={target.preview}
          onClose={closeUserProfile}
        />
      )}
    </UserProfileContext.Provider>
  )
}

/**
 * Global UserProfile context — lets any component open the UserProfileSheet
 * by simply calling openUserProfile(userId) without prop-drilling.
 *
 * Usage:
 *   const { openUserProfile } = useUserProfile()
 *   openUserProfile(someUserId)
 */
import { createContext, useContext, useCallback } from 'react'
import { useNavigate } from 'react-router'

interface UserProfileContextValue {
  openUserProfile: (
    userId: string, 
    preview?: { displayName?: string; avatarUrl?: string | null },
    commonGroup?: { title: string, coverUrl?: string | null }
  ) => void
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
  const navigate = useNavigate()

  const openUserProfile = useCallback((
    userId: string, 
    preview?: { displayName?: string; avatarUrl?: string | null },
    commonGroup?: { title: string, coverUrl?: string | null }
  ) => {
    navigate(`/profile/${userId}`)
  }, [navigate])

  const closeUserProfile = useCallback(() => {
    // No-op since we navigate now
  }, [])

  return (
    <UserProfileContext.Provider value={{ openUserProfile, closeUserProfile }}>
      {children}
    </UserProfileContext.Provider>
  )
}

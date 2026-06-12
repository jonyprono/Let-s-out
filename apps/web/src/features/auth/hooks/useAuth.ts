import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { authApi } from '../api'
import { useAuthStore } from '@/stores/auth.store'

export function useSendOtp() {
  return useMutation({
    mutationFn: authApi.sendOtp,
  })
}

export function useSendWhatsappOtp() {
  return useMutation({
    mutationFn: authApi.sendWhatsappOtp,
  })
}

export function useCheckTarget() {
  return useMutation({
    mutationFn: authApi.checkTarget,
  })
}

export function useCheckOtp() {
  return useMutation({
    mutationFn: authApi.checkOtp,
  })
}

export function useVerifyOtp() {
  return useMutation({
    mutationFn: authApi.verifyOtp,
  })
}

export function useRegister() {
  const { setAccessToken, setRefreshToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.register,
    onSuccess: ({ data }) => {
      setAccessToken(data.accessToken)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      setUser(data.user)
      navigate('/home')
    },
  })
}

import { toast } from 'sonner'

export function useInitLogin() {
  return useMutation({
    mutationFn: authApi.initLogin,
  })
}

export function useLogin() {
  const { setAccessToken, setRefreshToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.login,
    onSuccess: ({ data }) => {
      setAccessToken(data.accessToken)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      setUser(data.user)
      navigate('/home')
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || (error.message === 'Network Error' ? "Erreur réseau : serveur inaccessible" : 'Erreur lors de la connexion'))
    }
  })
}

export function useGoogleSignIn() {
  const nav = useNavigate()
  const { setAccessToken, setRefreshToken, setUser } = useAuthStore()

  return useMutation({
    mutationFn: authApi.googleSignIn,
    onSuccess: async (res) => {
      const data = res.data
      setAccessToken(data.accessToken)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      setUser(data.user as any)

      // Redirect to onboarding if new account created via Google
      if (data.isNewUser) {
        nav('/onboarding', { replace: true })
      } else {
        const p: any = data.user.profile || {}
        const isProfileIncomplete = !p.displayName || !p.avatarUrl || !p.birthdate || !p.interests || p.interests.length === 0
        if (isProfileIncomplete) {
          nav('/onboarding', { replace: true })
        } else {
          nav('/home', { replace: true })
        }
      }
    },
    onError: (err: any) => {
      if (err.response?.status === 403) {
        toast.error('Ce compte est désactivé. Contactez le support.')
      } else {
        toast.error(err.response?.data?.error || 'Erreur de connexion avec Google')
      }
    },
  })
}


export function useDirectLogin() {
  const { setAccessToken, setRefreshToken, setUser } = useAuthStore()
  const navigate = useNavigate()

  return useMutation({
    mutationFn: authApi.directLogin,
    onSuccess: ({ data }) => {
      setAccessToken(data.accessToken)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      setUser(data.user)
      navigate('/home')
    },
    onError: (error: any) => {
      if (error.message === 'Network Error') {
        toast.error("Erreur réseau : serveur inaccessible")
      } else {
        toast.error("Numéro ou Mot de passe incorrect")
      }
    }
  })
}

export function useLogout() {
  const { logout, setLoggingOut } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      setLoggingOut(true)
      try {
        await authApi.logout()
      } catch {
        // Même si l'API échoue, on déconnecte localement
      }
    },
    onSettled: () => {
      qc.clear()
      logout()
      setLoggingOut(false)
      navigate('/welcome', { replace: true })
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: authApi.resetPassword,
  })
}

export function useDeleteAccount() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (reason?: string) => {
      const { apiClient } = await import('@/lib/api-client')
      await apiClient.delete('/users/me', { data: { reason } })
    },
    onSuccess: () => {
      qc.clear()
      logout()
      navigate('/welcome', { replace: true })
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression du compte')
    },
  })
}

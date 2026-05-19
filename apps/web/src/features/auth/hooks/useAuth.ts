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

export function useLogout() {
  const { logout } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: authApi.logout,
    onMutate: () => {
      // Clear local state immediately for a fast UX
      qc.clear()
      logout()
      navigate('/welcome', { replace: true })
    },
    onSettled: () => {
      // Just to be sure we also clear state if there's any lag
      logout()
    },
  })
}

export function useResetPassword() {
  return useMutation({
    mutationFn: authApi.resetPassword,
  })
}

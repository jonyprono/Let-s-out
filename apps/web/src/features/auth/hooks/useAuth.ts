import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { authApi, type AuthResponse } from '../api'
import { useAuthStore } from '@/stores/auth.store'
import {
  useSignupIntroStore,
  hasCompletedSignupIntro,
  isSignupBlockedForSession,
} from '@/stores/signup-intro.store'
import i18n from '@/lib/i18n'

/** Âge minimum (MIN_SIGNUP_AGE) lu depuis le serveur — jamais codé en dur côté client. */
export function useSignupConfig() {
  return useQuery({
    queryKey: ['auth', 'signup-config'],
    queryFn: async () => (await authApi.signupConfig()).data,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  })
}

export function useCheckAge() {
  return useMutation({
    mutationFn: authApi.checkAge,
  })
}

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
  const { mutate: completeGoogle } = useCompleteGoogleSignup()

  return useMutation({
    mutationFn: authApi.googleSignIn,
    onSuccess: async (res) => {
      const data = res.data

      // Nouvel utilisateur Google : AUCUN compte n'est encore créé côté serveur.
      // Il doit passer par le parcours d'accueil (date de naissance + genre),
      // puis /auth/google/complete crée le compte (âge vérifié côté serveur).
      if ('needsCompletion' in data && data.needsCompletion) {
        const intro = useSignupIntroStore.getState()
        intro.setGoogle(
          { signupToken: data.signupToken, email: data.prefill.email },
          { firstName: data.prefill.firstName, lastName: data.prefill.lastName },
        )
        if (isSignupBlockedForSession()) {
          nav('/signup', { replace: true })
        } else if (hasCompletedSignupIntro(useSignupIntroStore.getState())) {
          // Parcours déjà rempli (Google choisi depuis l'écran téléphone) → finalisation directe
          completeGoogle()
        } else {
          nav('/signup?step=1', { replace: true })
        }
        return
      }

      // Compte existant : connexion inchangée
      const session = data as AuthResponse
      setAccessToken(session.accessToken)
      if (session.refreshToken) setRefreshToken(session.refreshToken)
      setUser(session.user as any)
      localStorage.removeItem('pending_google_signup')
      nav('/home', { replace: true })
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

/**
 * Crée le compte Google après le parcours d'accueil (POST /auth/google/complete)
 * avec les réponses du store, puis enchaîne sur la suite de l'inscription
 * Google existante (ville, centres d'intérêt, photo + CGU).
 */
export function useCompleteGoogleSignup() {
  const nav = useNavigate()
  const { setAccessToken, setRefreshToken, setUser } = useAuthStore()

  return useMutation({
    mutationFn: async () => {
      const s = useSignupIntroStore.getState()
      if (!s.google || !s.birthDate || !s.gender) throw new Error('INTRO_INCOMPLETE')
      return authApi.googleComplete({
        signupToken: s.google.signupToken,
        firstName: s.firstName,
        lastName: s.lastName,
        birthDate: s.birthDate,
        gender: s.gender,
      })
    },
    onSuccess: ({ data }) => {
      setAccessToken(data.accessToken)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      setUser(data.user as any)
      // Le compte existe : les réponses sont enregistrées côté serveur, on vide le store
      useSignupIntroStore.getState().reset()
      localStorage.setItem('pending_google_signup', 'true')
      nav('/signup?mode=google', { replace: true })
    },
    onError: (err: any) => {
      const status = err?.response?.status
      const code = err?.response?.data?.code
      const intro = useSignupIntroStore.getState()
      if (err?.message === 'INTRO_INCOMPLETE') {
        nav('/signup?step=1', { replace: true })
      } else if (status === 403 && code === 'UNDERAGE') {
        intro.markUnderage()
        nav('/signup', { replace: true })
      } else if (status === 401) {
        // Jeton d'inscription expiré (30 min) : on garde les réponses, il suffit de relancer Google
        intro.setGoogle(null)
        toast.error(i18n.t('signupIntro.googleExpired'))
        nav('/signup', { replace: true })
      } else if (status === 409) {
        intro.setGoogle(null)
        toast.error(i18n.t('signup.errorExists'))
        nav('/login', { replace: true })
      } else {
        toast.error(err?.response?.data?.error || i18n.t('signupIntro.errorNetwork'))
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
      // 1. Vider le cache React Query en mémoire
      qc.clear()

      // 2. Purger le cache persisté localStorage (données app)
      localStorage.removeItem('LETSOUT_QUERY_CACHE_V1')

      // 3. Purger les clés UI/chat sensibles
      const sensitiveKeys = [
        'letsout_pinned_convs',
        'letsout_muted_convs',
        'letsout_hidden_convs',
        'letsout_forceread_convs',
        'letsout_forceunread_convs',
        'pending_google_signup',
      ]
      sensitiveKeys.forEach(k => localStorage.removeItem(k))

      // 4. Purger les clés deleted-messages-* (pattern dynamique)
      const patternKeys: string[] = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key?.startsWith('deleted-messages-')) patternKeys.push(key)
      }
      patternKeys.forEach(k => localStorage.removeItem(k))

      // 5. Réinitialiser le store Zustand (efface letsout-auth via persist)
      //    + réponses d'un éventuel parcours d'inscription en cours sur cet appareil
      useSignupIntroStore.getState().reset()
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
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (reason?: string) => {
      const { apiClient } = await import('@/lib/api-client')
      await apiClient.delete('/users/me', { data: { reason } })
    },
    onSuccess: () => {
      qc.clear()
      logout()
      // Delay to allow React to unmount portals (modals) cleanly before navigating
      setTimeout(() => {
        window.location.href = '/welcome'
      }, 300)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erreur lors de la suppression du compte')
    },
  })
}

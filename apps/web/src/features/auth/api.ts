import { apiClient } from '@/lib/api-client'
import type { AuthUser } from '@/stores/auth.store'

export interface SendOtpPayload {
  target: string
  type: 'phone' | 'email'
  channel?: 'whatsapp' | 'sms'
}

export interface VerifyOtpPayload {
  target: string
  code: string
}

export interface CheckTargetPayload {
  target: string
}

export interface InitLoginPayload {
  target: string
  password: string
  channel?: 'whatsapp' | 'sms'
}

export interface RegisterPayload {
  target: string
  code?: string
  idToken?: string
  username: string
  // Prénom, nom, date (AAAA-MM-JJ) et genre : issus du parcours d'accueil, obligatoires côté serveur
  firstName: string
  lastName: string
  birthDate: string
  gender: 'FEMALE' | 'MALE' | 'OTHER'
  password?: string
}

/** Réponse de /auth/google pour un e-mail inconnu : aucun compte créé, finaliser via /auth/google/complete */
export interface GoogleNeedsCompletionResponse {
  isNewUser: true
  needsCompletion: true
  signupToken: string
  prefill: { firstName: string; lastName: string; email: string }
}

export interface LoginPayload {
  target: string
  code?: string
  idToken?: string
  password?: string
}

export interface ResetPasswordPayload {
  target: string
  code?: string
  idToken?: string
  newPassword: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken?: string
  user: AuthUser
  isNewUser?: boolean
}

export const authApi = {
  sendOtp: (payload: SendOtpPayload) =>
    apiClient.post<{ message: string }>('/auth/send-otp', payload),

  sendWhatsappOtp: (payload: { target: string }) =>
    apiClient.post<{ message: string }>('/auth/send-whatsapp-otp', payload),

  checkTarget: (payload: CheckTargetPayload) =>
    apiClient.post<{ exists: boolean }>('/auth/check-target', payload),

  checkOtp: (payload: VerifyOtpPayload) =>
    apiClient.post<{ valid: boolean }>('/auth/check-otp', payload),

  verifyOtp: (payload: VerifyOtpPayload) =>
    apiClient.post<{ valid: boolean }>('/auth/verify-otp', payload),

  register: (payload: RegisterPayload) =>
    apiClient.post<AuthResponse>('/auth/register', payload),

  initLogin: (payload: InitLoginPayload) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/login/init', payload),

  login: (payload: LoginPayload) =>
    apiClient.post<AuthResponse>('/auth/login', payload),

  directLogin: (payload: { target: string; password: string }) =>
    apiClient.post<AuthResponse>('/auth/login', { target: payload.target, password: payload.password }),

  googleSignIn: (payload: { idToken: string; email: string }) =>
    apiClient.post<AuthResponse | GoogleNeedsCompletionResponse>('/auth/google', payload),

  refresh: () =>
    apiClient.post<{ accessToken: string }>('/auth/refresh'),

  logout: () =>
    apiClient.post('/auth/logout'),

  me: () =>
    apiClient.get<AuthUser>('/auth/me'),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', payload),

  // ── Parcours d'accueil avant inscription ──
  signupConfig: () =>
    apiClient.get<SignupConfig>('/auth/signup-config'),

  /** Confirmation serveur de l'âge (rien n'est enregistré). 403 + code UNDERAGE si trop jeune. */
  checkAge: (payload: { birthDate: string }) =>
    apiClient.post<{ allowed: true; age: number; minSignupAge: number }>('/auth/check-age', payload),

  googleComplete: (payload: GoogleCompletePayload) =>
    apiClient.post<AuthResponse>('/auth/google/complete', payload),
}

export interface SignupConfig {
  minSignupAge: number
}

export interface SignupIdentity {
  firstName: string
  lastName: string
  birthDate: string // AAAA-MM-JJ
  gender: 'FEMALE' | 'MALE' | 'OTHER'
}

export interface GoogleCompletePayload extends SignupIdentity {
  signupToken: string
}

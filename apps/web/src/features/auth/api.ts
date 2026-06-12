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
  displayName: string
  birthDate?: string
  gender?: string
  password?: string
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
    apiClient.post<AuthResponse>('/auth/google', payload),

  refresh: () =>
    apiClient.post<{ accessToken: string }>('/auth/refresh'),

  logout: () =>
    apiClient.post('/auth/logout'),

  me: () =>
    apiClient.get<AuthUser>('/auth/me'),

  resetPassword: (payload: ResetPasswordPayload) =>
    apiClient.post<{ success: boolean; message: string }>('/auth/reset-password', payload),
}

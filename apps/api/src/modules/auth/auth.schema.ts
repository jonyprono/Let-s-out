import { z } from 'zod'

export const SendOtpSchema = z.object({
  target: z.string().min(1, 'Phone or email required'),
  type: z.enum(['phone', 'email']),
  channel: z.enum(['whatsapp', 'sms']).optional(),
})

export const SendWhatsappOtpSchema = z.object({
  target: z.string().min(1, 'Phone number is required'),
})

export const CheckTargetSchema = z.object({
  target: z.string().min(1),
})

export const InitLoginSchema = z.object({
  target: z.string().min(1),
  password: z.string().min(1, 'Le mot de passe est requis'),
  channel: z.enum(['whatsapp', 'sms']).optional(),
})

export const VerifyOtpSchema = z.object({
  target: z.string().min(1),
  code: z.string().length(6, 'OTP must be 6 digits'),
})

export const RegisterSchema = z.object({
  target: z.string().min(1),
  code: z.string().length(6).optional(),
  idToken: z.string().optional(),
  username: z
    .string()
    .min(3)
    .max(30)
    .regex(/^[a-z0-9_]+$/, 'Only lowercase, numbers and underscores'),
  displayName: z.string().min(2).max(50),
  birthDate: z.string().datetime().optional(),
  gender: z.string().optional(),
  password: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères').optional(),
})

export const LoginSchema = z.object({
  target: z.string().min(1),
  code: z.string().min(4).optional(),
  idToken: z.string().optional(),
  password: z.string().optional(), // direct password login (no OTP)
})

export const RefreshSchema = z.object({
  refreshToken: z.string().optional(), // also accepted from cookie
})

export const ResetPasswordSchema = z.object({
  target: z.string().min(1),
  code: z.string().length(6).optional(),
  idToken: z.string().optional(),
  newPassword: z.string().min(6, 'Le mot de passe doit faire au moins 6 caractères'),
})

export type SendOtpInput      = z.infer<typeof SendOtpSchema>
export type VerifyOtpInput    = z.infer<typeof VerifyOtpSchema>
export type RegisterInput     = z.infer<typeof RegisterSchema>
export type LoginInput        = z.infer<typeof LoginSchema>
export type CheckTargetInput  = z.infer<typeof CheckTargetSchema>
export type InitLoginInput    = z.infer<typeof InitLoginSchema>
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>

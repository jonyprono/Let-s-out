/**
 * AuthLogger - Centralized diagnostic logger for Firebase authentication flows.
 *
 * In production (Android/web), each log is silently POSTed to the Render backend
 * at POST /api/v1/auth/client-log → visible in the Render dashboard logs.
 *
 * Locally, logs appear only in the browser/DevTools console.
 */

import { apiClient } from '@/lib/api-client'

export type AuthLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'DEBUG'

export interface AuthLogEntry {
  timestamp: string
  level: AuthLogLevel
  flow: string
  step: string
  data?: Record<string, any>
  error?: string
}

const IS_DEV = import.meta.env.DEV

function formatTimestamp(): string {
  return new Date().toISOString()
}

/** Fire-and-forget: send log entry to Render backend (never throws) */
function sendToRender(entry: AuthLogEntry): void {
  // Ne pas attendre la réponse — silencieux
  apiClient.post('/auth/client-log', entry).catch(() => {
    // Silently ignore if network is unavailable
  })
}

function log(
  level: AuthLogLevel,
  flow: string,
  step: string,
  data?: Record<string, any>,
  error?: Error | unknown,
): void {
  const errorStr = error instanceof Error
    ? `${error.name}: ${error.message}`
    : error
      ? String(error)
      : undefined

  const entry: AuthLogEntry = {
    timestamp: formatTimestamp(),
    level,
    flow,
    step,
    ...(data ? { data } : {}),
    ...(errorStr ? { error: errorStr } : {}),
  }

  // Toujours visible en développement dans la console
  if (IS_DEV) {
    const prefix = `[LetsOut][${level}][${flow}] ${step}`
    if (level === 'ERROR') {
      console.error(prefix, data ?? '', errorStr ?? '')
    } else if (level === 'WARN') {
      console.warn(prefix, data ?? '')
    } else {
      console.log(prefix, data ?? '')
    }
  }

  // Envoyer silencieusement au backend Render (production ET dev)
  sendToRender(entry)
}

// ─── Google Sign-In Logger ─────────────────────────────────────────────────

export const googleAuthLogger = {
  start(platform: 'native' | 'web') {
    log('INFO', 'GoogleSignIn', '1. Démarrage connexion Google', { platform })
  },

  nativeSignInAttempt() {
    log('INFO', 'GoogleSignIn', '2. [Native] Appel FirebaseAuthentication.signInWithGoogle()')
  },

  nativeSignInResult(email: string | undefined) {
    if (email) {
      log('SUCCESS', 'GoogleSignIn', '3. [Native] Résultat reçu', { email })
    } else {
      log('ERROR', 'GoogleSignIn', '3. [Native] Résultat sans email — SHA-1 Play Store manquant ou incorrect dans Firebase')
    }
  },

  nativeGetIdToken() {
    log('INFO', 'GoogleSignIn', '4. [Native] Appel FirebaseAuthentication.getIdToken()')
  },

  nativeIdTokenResult(hasToken: boolean) {
    if (hasToken) {
      log('SUCCESS', 'GoogleSignIn', '5. [Native] ID Token obtenu avec succès')
    } else {
      log('ERROR', 'GoogleSignIn', '5. [Native] ID Token vide — Problème de configuration Firebase')
    }
  },

  webSignInAttempt() {
    log('INFO', 'GoogleSignIn', '2. [Web] Appel signInWithPopup()')
  },

  webSignInResult(email: string) {
    log('SUCCESS', 'GoogleSignIn', '3. [Web] Connexion popup réussie', { email })
  },

  backendCallStart(email: string) {
    log('INFO', 'GoogleSignIn', '6. Envoi idToken au backend', { email })
  },

  backendCallSuccess(userId?: string) {
    log('SUCCESS', 'GoogleSignIn', '7. Authentification backend réussie', { userId })
  },

  backendCallError(error: unknown) {
    log('ERROR', 'GoogleSignIn', '7. Erreur backend lors de googleSignIn', {
      status: (error as any)?.response?.status,
      message: (error as any)?.response?.data?.message,
    }, error)
  },

  error(step: string, error: unknown) {
    log('ERROR', 'GoogleSignIn', `ERREUR — ${step}`, {
      code: (error as any)?.code,
      message: (error as any)?.message,
    }, error)
  },
}

// ─── OTP Logger ────────────────────────────────────────────────────────────

export const otpLogger = {
  sendStart(target: string, channel: 'sms' | 'whatsapp') {
    const masked = target.slice(0, -4) + '****'
    log('INFO', 'OTP', '1. Envoi OTP demandé', { target: masked, channel })
  },

  sendRequest(channel: 'sms' | 'whatsapp') {
    log('INFO', 'OTP', '2. Requête envoi OTP', { channel })
  },

  sendSuccess(channel: 'sms' | 'whatsapp', message?: string) {
    log('SUCCESS', 'OTP', '3. OTP envoyé avec succès', { channel, detail: message })
  },

  sendError(error: unknown) {
    log('ERROR', 'OTP', '3. Échec envoi OTP', {
      status: (error as any)?.response?.status,
      backendMessage: (error as any)?.response?.data?.message,
      code: (error as any)?.code,
    }, error)
  },

  verifyStart(target: string) {
    const masked = target.slice(0, -4) + '****'
    log('INFO', 'OTP', '4. Vérification OTP démarrée', { target: masked })
  },

  verifyRequest() {
    log('INFO', 'OTP', '5. Requête vérification OTP envoyée')
  },

  verifySuccess() {
    log('SUCCESS', 'OTP', '6. OTP vérifié avec succès')
  },

  verifyError(error: unknown) {
    log('ERROR', 'OTP', '6. Échec vérification OTP', {
      status: (error as any)?.response?.status,
      backendMessage: (error as any)?.response?.data?.message,
    }, error)
  },

  phoneValidation(isValid: boolean, phoneCode: string) {
    if (isValid) {
      log('SUCCESS', 'OTP', '0. Numéro de téléphone valide', { phoneCode })
    } else {
      log('WARN', 'OTP', '0. Numéro de téléphone invalide', { phoneCode })
    }
  },
}

import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Shield, Loader2, ArrowLeft, MessageCircle, Phone, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { isFieldValid } from '@/lib/validation'
import { apiClient } from '@/lib/api-client'
import { auth } from '@/lib/firebase'
import { RecaptchaVerifier, signInWithPhoneNumber, ConfirmationResult } from 'firebase/auth'

declare global {
  interface Window { recaptchaVerifier: any; }
}

type Step = 1 | 2 | 3 | 4

export function AdminResetPasswordPage() {
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [target, setTarget] = useState('')
  const [channel, setChannel] = useState<'whatsapp' | 'sms'>('whatsapp')
  const [otp, setOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null)

  // ─── Étape 1 : Vérification identifiant ─────────────────────────────────────
  const handleCheckTarget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target.trim()) return
    setError('')
    setLoading(true)
    try {
      // Pré-vérification : L'admin existe ?
      await apiClient.post('/auth/admin-reset-password-otp', {
        target: target.trim(),
        channel: 'whatsapp', // Juste pour déclencher l'API
      })
      // S'il existe, l'API envoie l'OTP, mais on va l'ignorer et utiliser Firebase pour le SMS.
      setStep(2)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Identifiant introuvable.')
    } finally {
      setLoading(false)
    }
  }

  // ─── Étape 2 : Envoi OTP via Firebase ───────────────────────────────────
  const handleSendOtp = async () => {
    setChannel('sms')
    setError('')
    setLoading(true)
    try {
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch {}
        window.recaptchaVerifier = undefined;
      }
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-admin', { size: 'invisible' })
      const confirmation = await signInWithPhoneNumber(auth, target.trim(), window.recaptchaVerifier)
      setConfirmationResult(confirmation)
      setStep(3)
    } catch (err: any) {
      console.error(err)
      setError("Erreur Firebase. Vérifiez que votre numéro commence par +229...")
      if (window.recaptchaVerifier) {
        try { window.recaptchaVerifier.clear(); } catch {}
        window.recaptchaVerifier = undefined;
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── Étape 3 : Saisie OTP + nouveau mot de passe ────────────────────────────
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.length < 4 || !newPassword) return
    if (newPassword !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas.')
      return
    }
    if (newPassword.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères.')
      return
    }
    setError('')
    setLoading(true)
    try {
      let idToken = ''
      if (confirmationResult) {
        const cred = await confirmationResult.confirm(otp)
        idToken = await cred.user.getIdToken()
      }
      
      await apiClient.post('/auth/admin-reset-password', {
        target: target.trim(),
        code: confirmationResult ? undefined : otp,
        idToken: idToken || undefined,
        newPassword,
      })
      setStep(4)
    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.error || 'Code invalide ou expiré.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden">
      <div id="recaptcha-container-admin" />
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10 p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">

        {/* Header */}
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-500/20">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {step === 4 ? 'Mot de passe mis à jour' : 'Réinitialiser le mot de passe'}
          </h1>
          <p className="text-white/50 text-sm">
            {step === 1 && 'Entrez votre identifiant administrateur pour continuer.'}
            {step === 2 && 'Choisissez comment recevoir votre code de vérification.'}
            {step === 3 && `Code envoyé via ${channel === 'whatsapp' ? 'WhatsApp' : 'SMS'} au ${target}. Saisissez-le ci-dessous.`}
            {step === 4 && 'Votre mot de passe a été réinitialisé avec succès.'}
          </p>
        </div>

        {/* ── Étape 1 : Identifiant ── */}
        {step === 1 && (
          <form onSubmit={handleCheckTarget} className="space-y-4 mt-8">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Email ou Numéro (ex: +229...)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors"
              autoFocus
              required
            />

            {error && (
              <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !isFieldValid(target)}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Continuer'}
            </button>

            <button
              type="button"
              onClick={() => navigate('/admin/login')}
              className="w-full flex items-center justify-center gap-2 text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour à la connexion
            </button>
          </form>
        )}

        {/* ── Étape 2 : Choix du canal ── */}
        {step === 2 && (
          <div className="space-y-4 mt-8">
            <p className="text-white/60 text-sm text-center">
              Identifiant : <span className="text-white font-medium">{target}</span>
            </p>

            <button
              onClick={() => handleSendOtp()}
              disabled={loading}
              className="w-full flex items-center gap-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-blue-500/40 rounded-2xl px-5 py-4 transition-all disabled:opacity-50 active:scale-[0.98]"
            >
              <div className="w-10 h-10 bg-blue-500/15 text-blue-400 rounded-xl flex items-center justify-center flex-shrink-0">
                <Phone className="w-5 h-5" />
              </div>
              <div className="text-left">
                <p className="text-white font-semibold text-sm">Continuer</p>
                <p className="text-white/40 text-xs">Recevoir le code par SMS sécurisé</p>
              </div>
              {loading && <Loader2 className="w-4 h-4 animate-spin text-white/40 ml-auto" />}
            </button>

            {error && (
              <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => { setStep(1); setError('') }}
              className="w-full flex items-center justify-center gap-2 text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Modifier l'identifiant
            </button>
          </div>
        )}

        {/* ── Étape 3 : Code OTP + nouveau mot de passe ── */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4 mt-8">
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="Code de vérification (6 chiffres)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors tracking-widest text-center text-lg font-bold"
              inputMode="numeric"
              autoFocus
              required
            />

            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Nouveau mot de passe (min. 6 caractères)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirmer le mot de passe"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>

            {error && (
              <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || otp.length < 4 || newPassword.length < 6 || newPassword !== confirmPassword}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Réinitialiser le mot de passe'}
            </button>

            <button
              type="button"
              onClick={() => { setStep(2); setOtp(''); setError('') }}
              className="w-full flex items-center justify-center gap-2 text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Renvoyer le code
            </button>
          </form>
        )}

        {/* ── Étape 4 : Succès ── */}
        {step === 4 && (
          <div className="space-y-6 mt-8 text-center">
            <div className="w-20 h-20 bg-green-500/15 text-green-400 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-10 h-10" />
            </div>
            <p className="text-white/60 text-sm">
              Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
            </p>
            <button
              onClick={() => navigate('/admin/login')}
              className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all active:scale-[0.98]"
            >
              Se connecter
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

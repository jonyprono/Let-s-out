import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Shield, Loader2, Eye, EyeOff } from 'lucide-react'
import { isFieldValid } from '@/lib/validation'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'
import { updateAdminActivity } from '@/app/components/admin/AdminRoute'

export function AdminLoginPage() {
  const [target, setTarget] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const navigate = useNavigate()
  
  const setAccessToken = useAuthStore(s => s.setAccessToken)
  const setRefreshToken = useAuthStore(s => s.setRefreshToken)
  const setUser = useAuthStore(s => s.setUser)
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.accessToken)

  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      navigate('/admin', { replace: true })
    }
  }, [token, user, navigate])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!target || !password) return
    
    setError('')
    setLoading(true)

    try {
      const res = await apiClient.post('/auth/admin-login', { 
        target: target.trim(),
        password
      })

      const { accessToken, refreshToken, user: authUser } = res.data
      setAccessToken(accessToken)
      setRefreshToken(refreshToken)
      setUser(authUser)
      updateAdminActivity() // Démarrer le timer d'activité dès la connexion
      navigate('/admin', { replace: true })

    } catch (err: any) {
      console.error(err)
      setError(err.response?.data?.error || "Identifiants invalides.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden transition-colors">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10 p-8 rounded-3xl border border-white/10 bg-[#111115]">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-500/20">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Accès Administrateur</h1>
          <p className="text-white/50 text-sm">
            Entrez vos identifiants pour accéder au dashboard.
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4 mt-8">
          <div>
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="Email ou Numéro (ex: +229...)"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/60 transition-colors"
              autoFocus
              required
            />
          </div>

          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/60 transition-colors"
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => navigate('/admin/reset-password')}
              className="text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
            >
              Mot de passe oublié ?
            </button>
          </div>

          {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">{error}</p>}

          <button
            type="submit"
            disabled={loading || !isFieldValid(target) || password.length < 4}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Se connecter'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate(token ? '/home' : '/login')}
            className="w-full text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
          >
            Retour à l'application
          </button>
        </form>
      </div>
    </div>
  )
}

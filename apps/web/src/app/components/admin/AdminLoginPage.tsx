import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { Shield, Loader2 } from 'lucide-react'
import { apiClient } from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth.store'

export function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()
  
  const setAuth = useAuthStore(s => s.setAuth)
  const user = useAuthStore(s => s.user)
  const token = useAuthStore(s => s.accessToken)

  // Redirection automatique si déjà admin
  useEffect(() => {
    if (token && user?.role === 'ADMIN') {
      navigate('/admin', { replace: true })
    }
  }, [token, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await apiClient.post('/auth/admin-login', { password })
      const { accessToken, refreshToken, user: authUser } = res.data
      
      setAuth(accessToken, refreshToken, authUser)
      navigate('/admin', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error || 'Mot de passe incorrect')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-red-500/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="w-full max-w-md space-y-8 relative z-10 p-8 rounded-3xl border border-white/10 bg-white/[0.02] backdrop-blur-xl">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-inner border border-red-500/20">
            <Shield className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Accès Administrateur</h1>
          <p className="text-white/50 text-sm">Entrez le mot de passe prédéfini pour accéder au dashboard.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-8">
          <div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Mot de passe admin..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-red-500/50 transition-colors"
              autoFocus
            />
          </div>

          {error && <p className="text-red-400 text-sm text-center font-medium bg-red-500/10 py-2 rounded-xl border border-red-500/20">{error}</p>}

          <button
            type="submit"
            disabled={loading || !password}
            className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-4 rounded-2xl transition-all flex items-center justify-center disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Déverrouiller le Dashboard'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate(token ? '/home' : '/login')}
            className="w-full text-white/40 text-sm font-medium py-3 hover:text-white/80 transition-colors"
          >
            Retour
          </button>
        </form>
      </div>
    </div>
  )
}

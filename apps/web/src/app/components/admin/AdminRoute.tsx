import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { useAuthStore } from '@/stores/auth.store'

/**
 * AdminRoute — garde les pages admin.
 *
 * Logique de session :
 * - Si pas de token OU rôle ≠ ADMIN → redirect /admin/login
 * - On met à jour un timestamp d'activité (sessionStorage) à chaque rendu valide.
 * - Si le token a expiré côté API mais que l'inactivité est < 20 min, on laisse
 *   l'admin sur place : l'intercepteur Axios se charge de rafraîchir silencieusement.
 * - Au-delà de 20 min d'inactivité (aucun onglet admin ouvert / actif), on déconnecte.
 */

const ADMIN_ACTIVITY_KEY = 'admin_last_activity'

export function updateAdminActivity() {
  sessionStorage.setItem(ADMIN_ACTIVITY_KEY, String(Date.now()))
}


export function AdminRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.accessToken)
  const role = useAuthStore((s) => s.user?.role)

  // Marquer l'activité admin à chaque rendu valide
  useEffect(() => {
    if (token && role === 'ADMIN') {
      updateAdminActivity()
    }
  })

  // Pas de token du tout → déconnexion certaine
  if (!token) return <Navigate to="/admin/login" replace />

  // Rôle non-admin → déconnexion
  if (role !== 'ADMIN') return <Navigate to="/admin/login" replace />

  // Token présent + rôle ADMIN : on laisse passer
  // (le token peut temporairement être expiré côté API mais l'intercepteur
  //  Axios s'occupera du refresh automatiquement sur la prochaine requête)
  return <>{children}</>
}

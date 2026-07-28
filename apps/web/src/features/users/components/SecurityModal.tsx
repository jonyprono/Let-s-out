import { useState } from 'react';
import { X, ShieldCheck, KeyRound, MonitorSmartphone, Loader2, AlertCircle, Trash2, ArrowRight } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { ChangePasswordModal } from './ChangePasswordModal';
import { useNavigate } from 'react-router';

interface Session {
  id: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

interface Props {
  onClose: () => void;
  kycStatus: 'pending' | 'verified' | 'rejected' | null;
}

function parseUserAgent(ua: string) {
  if (!ua) return 'Appareil inconnu';
  
  let browser = 'Navigateur inconnu';
  if (ua.includes('Firefox')) browser = 'Firefox';
  else if (ua.includes('Edg')) browser = 'Edge';
  else if (ua.includes('Chrome')) browser = 'Chrome';
  else if (ua.includes('Safari')) browser = 'Safari';
  
  let os = 'OS inconnu';
  if (ua.includes('Win')) os = 'Windows';
  else if (ua.includes('Mac')) os = 'macOS';
  else if (ua.includes('Android')) os = 'Android';
  else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
  else if (ua.includes('Linux')) os = 'Linux';
  
  return `${browser} sur ${os}`;
}

export function SecurityModal({ onClose, kycStatus }: Props) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  // 1. Password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  // 2. Fetch Sessions
  const { data: sessions, isLoading: loadingSessions } = useQuery<Session[]>({
    queryKey: ['my-sessions'],
    queryFn: async () => {
      const { data } = await apiClient.get('/users/me/sessions');
      return data;
    },
  });

  // 3. Revoke single session
  const { mutate: revokeSession, isPending: revokingId } = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/users/me/sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    },
  });

  // 4. Revoke all other sessions
  const { mutate: revokeAll, isPending: revokingAll } = useMutation({
    mutationFn: () => apiClient.delete('/users/me/sessions'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] });
    },
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#1A1A1A] rounded-[32px] p-6 shadow-xl animate-in slide-in-from-bottom-4 sm:slide-in-from-bottom-0 sm:zoom-in-95 max-h-[85vh] overflow-y-auto hide-scrollbar">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 sticky top-0 bg-white dark:bg-[#1A1A1A] z-10 py-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-blue-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Sécurité</h2>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-[#2A2A2A] rounded-full hover:bg-gray-200 dark:hover:bg-[#333333] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="space-y-6">
          {/* Section 1: Mot de passe */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Mot de passe</h3>
            <button
              onClick={() => setShowPasswordModal(true)}
              className="w-full bg-gray-50 dark:bg-[#222222] hover:bg-gray-100 dark:hover:bg-[#2A2A2A] rounded-2xl p-4 flex items-center justify-between transition-colors border border-gray-100 dark:border-[#333333]"
            >
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-[#FF7A00]/10 flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-[#FF7A00]" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900 dark:text-white">Modifier le mot de passe</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Sécurisez votre compte</p>
                </div>
              </div>
              <ArrowRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Section 2: KYC */}
          <div>
            <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Vérification de profil</h3>
            <div className="bg-gray-50 dark:bg-[#222222] rounded-2xl p-4 border border-gray-100 dark:border-[#333333]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    kycStatus === 'verified' ? 'bg-green-50 text-green-500 dark:bg-green-500/10' :
                    kycStatus === 'pending' ? 'bg-yellow-50 text-yellow-500 dark:bg-yellow-500/10' :
                    kycStatus === 'rejected' ? 'bg-red-50 text-red-500 dark:bg-red-500/10' :
                    'bg-gray-200 text-gray-500 dark:bg-gray-800'
                  }`}>
                    {kycStatus === 'verified' ? <ShieldCheck className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">Statut KYC</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {kycStatus === 'verified' && 'Profil vérifié'}
                      {kycStatus === 'pending' && 'En cours d\'examen'}
                      {kycStatus === 'rejected' && 'Vérification rejetée'}
                      {!kycStatus && 'Non soumis'}
                    </p>
                  </div>
                </div>
              </div>

              {kycStatus === 'rejected' && (
                <p className="text-sm text-red-500 bg-red-50 dark:bg-red-500/10 p-3 rounded-xl mb-3">
                  Votre document a été refusé. Veuillez réessayer.
                </p>
              )}

              {(!kycStatus || kycStatus === 'rejected') && (
                <button
                  onClick={() => { onClose(); navigate('/verify-profile'); }}
                  className="w-full py-3 bg-[#FF7A00] text-white rounded-xl font-semibold text-sm hover:bg-[#E66E00] transition-colors"
                >
                  Lancer la vérification
                </button>
              )}
            </div>
          </div>

          {/* Section 3: Sessions */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Sessions actives</h3>
              {sessions && sessions.length > 1 && (
                <button 
                  onClick={() => revokeAll()}
                  disabled={revokingAll}
                  className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                >
                  {revokingAll ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Tout déconnecter'}
                </button>
              )}
            </div>
            
            <div className="space-y-3">
              {loadingSessions ? (
                <div className="flex justify-center p-4"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
              ) : sessions?.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">Aucune session active</p>
              ) : (
                sessions?.map((session) => (
                  <div key={session.id} className="bg-gray-50 dark:bg-[#222222] rounded-2xl p-4 border border-gray-100 dark:border-[#333333] flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
                        <MonitorSmartphone className="w-5 h-5 text-indigo-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-gray-900 dark:text-white text-sm">
                            {parseUserAgent(session.userAgent)}
                          </p>
                          {session.isCurrent && (
                            <span className="px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400 text-[10px] font-bold tracking-wide uppercase">
                              Cet appareil
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Connecté le {new Date(session.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                    </div>
                    
                    {!session.isCurrent && (
                      <button 
                        onClick={() => revokeSession(session.id)}
                        disabled={revokingId}
                        className="p-2 text-red-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors"
                        title="Déconnecter"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  );
}

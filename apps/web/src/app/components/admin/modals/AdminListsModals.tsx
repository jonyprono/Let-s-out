import { useQuery } from '@tanstack/react-query';
import { X, Calendar, AlertTriangle, Shield, Ban } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ModalWrapper = ({ isOpen, onClose, title, description, children }: any) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[85vh] bg-[#111] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1A1A1A]">
          <div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
            {description && <p className="text-sm text-white/50">{description}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export const AdminPoolsModal = ({ isOpen, onClose }: ModalProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'active-pools'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/pools/active');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Cagnottes Actives" description="Événements avec des fonds collectés non retirés.">
      {isLoading ? (
        <div className="text-center py-10 text-white/50">Chargement...</div>
      ) : data?.length === 0 ? (
        <div className="text-center py-10 text-white/50">Aucune cagnotte active.</div>
      ) : (
        <div className="space-y-3">
          {data?.map((event: any) => (
            <div key={event.id} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <h3 className="font-bold text-white">{event.title}</h3>
                <p className="text-xs text-white/50">Organisé par {event.creator?.profile?.displayName}</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs px-2 py-1 bg-white/5 rounded text-white/70">
                    <Calendar className="w-3 h-3 inline mr-1" />
                    {format(new Date(event.startAt), 'dd/MM/yy')}
                  </span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-[#FF7A00]">{event.poolCollected.toLocaleString('fr-FR')} F</div>
                <div className="text-xs text-white/40">Déjà retiré : {event.poolWithdrawn.toLocaleString('fr-FR')} F</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalWrapper>
  );
};

export const AdminVotesModal = ({ isOpen, onClose }: ModalProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'active-votes'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/votes/active');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Votes Validateurs en cours" description="Votes en attente de résolution.">
      {isLoading ? (
        <div className="text-center py-10 text-white/50">Chargement...</div>
      ) : data?.length === 0 ? (
        <div className="text-center py-10 text-white/50">Aucun vote en cours.</div>
      ) : (
        <div className="space-y-3">
          {data?.map((event: any) => (
            <div key={event.id} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4">
              <div className="flex justify-between mb-2">
                <h3 className="font-bold text-white">{event.title}</h3>
                <span className="px-2 py-1 bg-amber-500/10 text-amber-500 text-xs font-bold rounded flex items-center gap-1">
                  <Shield className="w-3 h-3" /> En cours
                </span>
              </div>
              <p className="text-xs text-white/50 mb-3">Seuil: {event.validatorThreshold * 100}% | Validateurs inscrits: {event.validatorIds?.length || 0}</p>
              <div className="text-sm text-white/70">
                Votes reçus: <strong className="text-white">{event.validatorVotes?.length || 0}</strong>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalWrapper>
  );
};

export const AdminReportsModal = ({ isOpen, onClose }: ModalProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'pending-reports'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/reports?status=PENDING');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Signalements en attente" description="Signalements nécessitant une action de modération.">
      {isLoading ? (
        <div className="text-center py-10 text-white/50">Chargement...</div>
      ) : data?.length === 0 ? (
        <div className="text-center py-10 text-white/50">Aucun signalement en attente.</div>
      ) : (
        <div className="space-y-3">
          {data?.map((report: any) => (
            <div key={report.id} className="bg-[#1A1A1A] border border-red-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="font-bold text-white">Motif : {report.reason}</span>
                <span className="ml-auto text-xs text-white/40">{format(new Date(report.createdAt), 'dd/MM HH:mm')}</span>
              </div>
              {report.description && <p className="text-sm text-white/70 bg-[#111] p-2 rounded mb-3">"{report.description}"</p>}
              <div className="flex gap-4 text-xs text-white/50">
                <div>Plaignant: <strong className="text-white">{report.reporter?.profile?.displayName}</strong></div>
                <div>Accusé: <strong className="text-red-400">{report.reported?.profile?.displayName}</strong></div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalWrapper>
  );
};

export const AdminBlockedUsersModal = ({ isOpen, onClose }: ModalProps) => {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'blocked-users'],
    queryFn: async () => {
      const res = await apiClient.get('/admin/blocks');
      return res.data?.data || [];
    },
    enabled: isOpen,
  });

  return (
    <ModalWrapper isOpen={isOpen} onClose={onClose} title="Utilisateurs Bloqués" description="Relations de blocage entre utilisateurs.">
      {isLoading ? (
        <div className="text-center py-10 text-white/50">Chargement...</div>
      ) : data?.length === 0 ? (
        <div className="text-center py-10 text-white/50">Aucun utilisateur bloqué.</div>
      ) : (
        <div className="space-y-3">
          {data?.map((block: any) => (
            <div key={block.id} className="bg-[#1A1A1A] border border-white/5 rounded-xl p-4 flex items-center gap-4">
              <Ban className="w-5 h-5 text-red-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm">
                  <strong className="text-white">{block.initiator?.profile?.displayName}</strong> a bloqué <strong className="text-red-400">{block.receiver?.profile?.displayName}</strong>
                </div>
                <div className="text-xs text-white/40 mt-1">Le {format(new Date(block.updatedAt), 'dd MMM yyyy HH:mm', { locale: fr })}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ModalWrapper>
  );
};

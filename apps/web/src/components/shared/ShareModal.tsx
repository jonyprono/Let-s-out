import { useState } from 'react';
import { X, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { eventsApi } from '@/features/events/api';
import { SafeImage } from '@/components/shared/SafeImage';
import { shareLink } from '@/lib/utils';

interface ShareModalProps {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
}

export function ShareModal({ eventId, eventTitle, onClose }: ShareModalProps) {
  const [invitingUsers, setInvitingUsers] = useState<Set<string>>(new Set());
  const [invitedUsers, setInvitedUsers] = useState<Set<string>>(new Set());

  const { data: friendsData, isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => {
      const res = await apiClient.get('/users/me/friends', { params: { limit: 100 } });
      return res.data;
    },
  });
  const friends = friendsData?.data || [];

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/events/${eventId}`;
    await shareLink(eventTitle, `Découvrez "${eventTitle}" sur Let's Out !`, url);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center animate-in fade-in duration-200">
      <div className="w-full max-h-[82%] bg-white rounded-t-3xl flex flex-col animate-in slide-in-from-bottom duration-300 shadow-2xl">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full" />
        </div>
        {/* Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-gray-100 flex-shrink-0">
          <div>
            <h3 className="text-[18px] font-bold text-gray-900">Partager l'événement</h3>
            <p className="text-[12px] text-gray-400 mt-0.5">Invitez vos amis ou partagez le lien</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center active:scale-95">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Copy link */}
        <div className="px-5 pt-4 pb-2 flex-shrink-0">
          <button
            onClick={handleCopyLink}
            className="w-full py-3 rounded-2xl bg-action-primary text-white font-bold text-[14px] flex items-center justify-center gap-2 active:scale-[0.98] transition-transform shadow-sm shadow-orange-500/20"
          >
            <Share2 className="w-4 h-4" />
            Copier le lien d'invitation
          </button>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-3 px-5 py-2 flex-shrink-0">
          <div className="flex-1 h-px bg-gray-100" />
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wide">ou inviter des amis</p>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Friends list */}
        <div className="flex-1 overflow-y-auto px-5 pb-6" style={{ scrollbarWidth: 'none' }}>
          {friendsLoading ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-action-primary" />
              <p className="text-[13px] text-gray-400">Chargement de vos amis...</p>
            </div>
          ) : friends.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-orange-50 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">👥</span>
              </div>
              <p className="text-gray-700 font-bold text-[15px]">Aucun ami à inviter</p>
              <p className="text-gray-400 text-[13px] mt-1">Ajoutez des amis depuis votre profil.</p>
            </div>
          ) : (
            <div className="space-y-1">
              {friends.map((friend: any) => (
                <div key={friend.userId} className="flex items-center gap-3 py-2">
                  <div className="w-12 h-12 rounded-full bg-gray-100 overflow-hidden flex-shrink-0">
                    <SafeImage
                      src={friend.avatarUrl}
                      alt={friend.displayName}
                      className="w-full h-full object-cover"
                      fallback={<div className="w-full h-full flex items-center justify-center text-lg font-bold text-white" style={{ background: 'linear-gradient(135deg, var(--action-primary), var(--color-brand-orange-400))' }}>{(friend.displayName || 'A').charAt(0)}</div>}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-[14px] truncate">{friend.displayName}</p>
                    <p className="text-gray-400 text-[12px]">@{friend.username}</p>
                  </div>
                  <button
                    onClick={async () => {
                      if (invitedUsers.has(friend.userId)) return;
                      setInvitingUsers(s => new Set([...s, friend.userId]));
                      try {
                        await eventsApi.inviteFriends(eventId, [friend.userId]);
                        setInvitedUsers(s => new Set([...s, friend.userId]));
                        toast.success(`${friend.displayName} invité !`);
                      } catch {
                        toast.error('Erreur lors de l\'invitation');
                      } finally {
                        setInvitingUsers(s => { const n = new Set(s); n.delete(friend.userId); return n; });
                      }
                    }}
                    disabled={invitingUsers.has(friend.userId) || invitedUsers.has(friend.userId)}
                    className={`px-4 py-2 rounded-full text-[12px] font-bold transition-all active:scale-95 flex-shrink-0 ${
                      invitedUsers.has(friend.userId)
                        ? 'bg-green-100 text-green-600 border border-green-200'
                        : 'bg-action-primary active:bg-action-primary-hover text-white shadow-sm'
                    } disabled:opacity-60`}
                  >
                    {invitingUsers.has(friend.userId) ? <Loader2 className="w-4 h-4 animate-spin" /> : invitedUsers.has(friend.userId) ? '✓ Invité' : 'Inviter'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

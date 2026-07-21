import { useNavigate } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/features/notifications/api';
import { filterActiveNotifications } from '@/lib/notifications-group';
import {
  UserAdd01Icon,
  WalletDone02Icon,
  WalletAdd01Icon,
  TickDouble01Icon,
  Settings03Icon,
  Notification01Icon,
  UserMultiple02Icon,
} from 'hugeicons-react';
import { TopBar } from '@/components/ui/TopBar';
import { Tag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface NotificationsProps {
  onBack: () => void;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  EVENT_INVITE:        { icon: UserAdd01Icon,      label: 'Invitation',                 color: 'text-violet-500', bg: 'bg-violet-50 dark:bg-violet-900/20' },
  EVENT_UPDATE:        { icon: Notification01Icon,  label: 'Mise à jour',                color: 'text-blue-500',   bg: 'bg-blue-50 dark:bg-blue-900/20' },
  EVENT_CANCELLED:     { icon: Notification01Icon,  label: 'Événement annulé',           color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
  JOIN_REQUEST:        { icon: UserMultiple02Icon,  label: 'Demande de participation',   color: 'text-sky-500',    bg: 'bg-sky-50 dark:bg-sky-900/20' },
  JOIN_ACCEPTED:       { icon: TickDouble01Icon,    label: 'Participation acceptée',     color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  JOIN_CONFIRMED:      { icon: TickDouble01Icon,    label: 'Participation confirmée',    color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  NEW_MESSAGE:         { icon: Notification01Icon,  label: 'Nouveau message',            color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-900/20' },
  FRIEND_REQUEST:      { icon: UserAdd01Icon,       label: "Demande d'ami",              color: 'text-pink-500',   bg: 'bg-pink-50 dark:bg-pink-900/20' },
  FRIEND_ACCEPTED:     { icon: TickDouble01Icon,    label: 'Ami accepté',                color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  PAYMENT_SUCCESS:     { icon: WalletDone02Icon,    label: 'Paiement réussi',            color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  PAYMENT_FAILED:      { icon: Notification01Icon,  label: 'Paiement échoué',            color: 'text-red-500',    bg: 'bg-red-50 dark:bg-red-900/20' },
  POOL_UNLOCK_REQUEST: { icon: WalletDone02Icon,    label: 'Validation requise',         color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  POOL_NEW:            { icon: WalletAdd01Icon,     label: 'Nouvelle cagnotte',          color: 'text-amber-500',  bg: 'bg-amber-50 dark:bg-amber-900/20' },
  POOL_UNLOCK_APPROVED:{ icon: TickDouble01Icon,    label: 'Déblocage approuvé',         color: 'text-green-500',  bg: 'bg-green-50 dark:bg-green-900/20' },
  POOL_VOTE_STARTED:   { icon: Settings03Icon,      label: 'Vote en cours',              color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
  SYSTEM:              { icon: Notification01Icon,  label: 'Système',                    color: 'text-gray-500',   bg: 'bg-gray-50 dark:bg-gray-900/20' },
  EVENT_REVIEW_REQUEST:{ icon: Notification01Icon,  label: 'Avis demandé',               color: 'text-yellow-500', bg: 'bg-yellow-50 dark:bg-yellow-900/20' },
  default:             { icon: Notification01Icon,  label: 'Notification',               color: 'text-gray-400',   bg: 'bg-gray-50 dark:bg-gray-800' },
};

function getActionLabel(type: string) {
  switch (type) {
    case 'EVENT_INVITE':        return "Voir l'événement";
    case 'POOL_UNLOCK_REQUEST': return 'Voir la demande';
    case 'POOL_VOTE_STARTED':   return 'Ouvrir le vote';
    case 'NEW_MESSAGE':         return 'Ouvrir le chat';
    case 'FRIEND_REQUEST':      return 'Voir la demande';
    case 'POOL_NEW':            return 'Consulter la cagnotte';
    case 'POOL_UNLOCK_APPROVED':return 'Voir mon Wallet';
    case 'EVENT_REVIEW_REQUEST':return 'Laisser un avis';
    default:                    return 'Voir les détails';
  }
}

export function Notifications({ onBack }: NotificationsProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');
  const [selectedNotification, setSelectedNotification] = useState<any>(null);

  const { data, isLoading } = useNotifications(100, false);
  const allNotifications = data?.data ?? [];
  const unarchivedNotifications = useMemo(() => filterActiveNotifications(allNotifications), [allNotifications]);
  const visibleNotifications = useMemo(
    () => unarchivedNotifications.filter(n => n.type !== 'NEW_MESSAGE'),
    [unarchivedNotifications],
  );

  const displayedNotifications = useMemo(() => {
    if (activeTab === 'unread') {
      return visibleNotifications.filter(n => !n.isRead);
    }
    return visibleNotifications;
  }, [visibleNotifications, activeTab]);

  const activeUnreadCount = visibleNotifications.filter((n) => !n.isRead).length;

  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  useEffect(() => {
    if (data && data.unreadCount > 0 && activeUnreadCount === 0) {
      markAllReadMutation.mutate();
      queryClient.setQueryData(['notifications', { limit: 100, unreadOnly: false }], (old: any) => {
        if (!old) return old;
        return { ...old, unreadCount: 0 };
      });
    }
  }, [data?.unreadCount, activeUnreadCount]);

  const handleAction = (notif: any) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);
    setSelectedNotification(null);

    const d = notif.data as Record<string, string> | undefined;
    switch (notif.type) {
      case 'FRIEND_REQUEST':
        navigate('/friend-requests');
        break;
      case 'FRIEND_ACCEPTED':
        if (d?.userId) navigate(`/profile/${d.userId}`);
        else navigate('/friends');
        break;
      case 'EVENT_INVITE':
      case 'EVENT_UPDATE':
      case 'EVENT_CANCELLED':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'JOIN_REQUEST':
        if (d?.eventId) navigate(`/events/${d.eventId}/manage`);
        break;
      case 'JOIN_ACCEPTED':
      case 'JOIN_CONFIRMED':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'PAYMENT_SUCCESS':
        if (d?.bookingId) navigate(`/payments/${d.bookingId}`);
        else if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'PAYMENT_FAILED':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'POOL_NEW':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'POOL_UNLOCK_REQUEST':
        if (d?.eventId && d?.payoutId) navigate(`/events/${d.eventId}/payout-approval/${d.payoutId}`);
        else if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'POOL_UNLOCK_APPROVED':
        navigate('/wallet');
        break;
      case 'POOL_VOTE_STARTED':
        if (d?.eventId) navigate(`/events/${d.eventId}/validators-vote`);
        break;
      case 'EVENT_REVIEW_REQUEST':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'NEW_MESSAGE':
        if (d?.conversationId) navigate(`/chat/${d.conversationId}`);
        else navigate('/messages');
        break;
      case 'SYSTEM':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      default:
        break;
    }
  };

  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selectedNotification) {
    const cfg = TYPE_CONFIG[selectedNotification.type] ?? TYPE_CONFIG.default;
    const Icon = cfg.icon;
    const isPoolUnlock = selectedNotification.type === 'POOL_UNLOCK_REQUEST' || selectedNotification.type === 'POOL_UNLOCK_APPROVED';
    const timeAgo = formatDistanceToNow(new Date(selectedNotification.createdAt), { addSuffix: true, locale: fr });

    return (
      <div className="fixed inset-0 z-50 bg-[#F9F9F9] dark:bg-[#09090b] flex flex-col animate-in slide-in-from-right-8 duration-200">
        <TopBar
          title={cfg.label}
          onBack={() => setSelectedNotification(null)}
          containerClassName="bg-white dark:bg-[#09090b] border-b border-gray-100 dark:border-transparent pt-safe-4"
        />

        <div className="flex-1 overflow-y-auto px-4 pt-6 pb-6 space-y-4">
          {/* Icon + title card */}
          <div className="bg-white dark:bg-[#1A1A1A] rounded-[18px] p-5 shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-4 mb-4">
              <div className={`w-12 h-12 rounded-2xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                <Icon className={`w-6 h-6 ${cfg.color}`} />
              </div>
              <div className="flex-1">
                <p className={`text-[12px] font-semibold uppercase tracking-wider ${cfg.color} mb-0.5`}>{cfg.label}</p>
                <p className="text-[15px] font-bold text-gray-900 dark:text-white leading-snug">
                  {selectedNotification.title}
                </p>
              </div>
            </div>
            <p className="text-[14px] leading-[22px] text-gray-600 dark:text-gray-300">
              {selectedNotification.body}
            </p>
          </div>

          {/* Pool unlock reason pill – shown only for relevant types */}
          {isPoolUnlock && selectedNotification.data?.reason && (
            <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/40 rounded-[14px] p-4 flex items-start gap-3">
              <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0 mt-0.5">
                <Tag className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-0.5">Motif du déblocage</p>
                <p className="text-[14px] font-semibold text-gray-900 dark:text-white">{selectedNotification.data.reason}</p>
              </div>
            </div>
          )}

          {/* Timestamp */}
          <p className="text-[12px] text-gray-400 text-center">{timeAgo}</p>
        </div>

        {/* CTA */}
        <div className="p-4 pb-safe-4 bg-white dark:bg-[#09090b] border-t border-gray-100 dark:border-transparent">
          <button
            onClick={() => handleAction(selectedNotification)}
            className="w-full h-[52px] bg-[#FF7A00] text-white rounded-[14px] font-semibold text-[15px] flex items-center justify-center active:scale-95 transition-transform"
          >
            {getActionLabel(selectedNotification.type)}
          </button>
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#111111]">
      <TopBar
        title="Notifications"
        onBack={onBack}
        containerClassName="pt-safe-4"
        rightAction={
          activeUnreadCount > 0 ? (
            <button
              onClick={() => markAllReadMutation.mutate()}
              className="text-[12px] text-[#FF7A00] font-semibold"
            >
              Tout lire
            </button>
          ) : undefined
        }
      />

      {/* Tabs */}
      <div className="flex items-center gap-2 px-4 mb-2 mt-2">
        {(['all', 'unread'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
              activeTab === tab
                ? 'bg-[#FFF2E5] text-[#FF7A00]'
                : 'bg-transparent text-[#A3A3A3]'
            }`}
          >
            {tab === 'all' ? 'Toutes' : `Non lues${activeUnreadCount > 0 ? ` (${String(activeUnreadCount).padStart(2, '0')})` : ''}`}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center pb-safe-4 px-4 gap-2" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="w-full flex flex-col gap-3 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-50 dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-200 dark:bg-gray-700 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 dark:bg-gray-800 rounded-lg w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full text-center py-20">
            <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
              <Notification01Icon className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="font-bold text-[16px] text-gray-900 dark:text-white mb-2">Aucune notification</h3>
            <p className="text-[13px] text-gray-400">Vos notifications apparaîtront ici.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col pt-2">
            {displayedNotifications.map((notif, index) => {
              const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default;
              const Icon = cfg.icon;
              const timeAgo = notif.createdAt
                ? formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: fr })
                : '';
              return (
                <div key={notif.id} className="w-full flex flex-col">
                  <button
                    onClick={() => {
                      if (!notif.isRead) markReadMutation.mutate(notif.id);
                      setSelectedNotification(notif);
                    }}
                    className={`w-full flex flex-row items-start px-2 py-3.5 gap-3 relative transition-all active:bg-gray-50 dark:active:bg-[#18181b] rounded-xl ${!notif.isRead ? 'bg-[#FFF9F5] dark:bg-[#1a1200]/40' : ''}`}
                  >
                    {/* Icon */}
                    <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                      <Icon className={`w-5 h-5 ${cfg.color}`} />
                    </div>

                    {/* Text */}
                    <div className="flex flex-col items-start gap-0.5 flex-1 min-w-0">
                      <div className="flex items-center justify-between w-full">
                        <span className={`font-semibold text-[13px] leading-[20px] ${notif.isRead ? 'text-gray-700 dark:text-gray-300' : 'text-[#1B1818] dark:text-white'}`}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px] text-gray-400 shrink-0 ml-2">{timeAgo}</span>
                      </div>
                      <span className="text-[12px] leading-[18px] text-gray-500 dark:text-gray-400 text-left line-clamp-2">
                        {notif.body}
                      </span>
                    </div>

                    {/* Unread dot */}
                    {!notif.isRead && (
                      <div className="w-2 h-2 bg-[#FF7A00] rounded-full shrink-0 mt-1.5" />
                    )}
                  </button>

                  {index < displayedNotifications.length - 1 && (
                    <div className="w-full h-[0.5px] bg-gray-100 dark:bg-[#2A2A2A] ml-[52px]" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

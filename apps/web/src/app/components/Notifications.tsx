import { useNavigate } from 'react-router';
import { ChevronLeft, Heart, MessageCircle, UserPlus, Calendar, DollarSign, Bell, Check, Loader2, Users, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState } from 'react';

interface NotificationsProps {
  onBack: () => void;
}

// Exact mapping of Prisma NotifType enum values
const TYPE_CONFIG: Record<string, { icon: any; colorClass: string; label: string }> = {
  EVENT_INVITE:    { icon: Calendar,       colorClass: 'bg-orange-50 text-[#FF9F1C]', label: 'Invitation' },
  EVENT_UPDATE:    { icon: Calendar,       colorClass: 'bg-orange-50 text-[#FF9F1C]',    label: 'Mise à jour événement' },
  EVENT_CANCELLED: { icon: Calendar,       colorClass: 'bg-red-50 text-red-500',      label: 'Événement annulé' },
  JOIN_REQUEST:    { icon: Users,          colorClass: 'bg-orange-50 text-[#FF9F1C]', label: 'Demande de participation' },
  JOIN_ACCEPTED:   { icon: CheckCircle,    colorClass: 'bg-green-50 text-green-500',  label: 'Participation acceptée' },
  NEW_MESSAGE:     { icon: MessageCircle,  colorClass: 'bg-orange-50 text-[#FF9F1C]', label: 'Nouveau message' },
  FRIEND_REQUEST:  { icon: UserPlus,       colorClass: 'bg-orange-50 text-[#FF9F1C]',    label: 'Demande d\'ami' },
  FRIEND_ACCEPTED: { icon: Heart,          colorClass: 'bg-pink-50 text-pink-500',    label: 'Ami accepté' },
  PAYMENT_SUCCESS: { icon: DollarSign,     colorClass: 'bg-green-50 text-green-500',  label: 'Paiement réussi' },
  PAYMENT_FAILED:  { icon: AlertCircle,    colorClass: 'bg-red-50 text-red-500',      label: 'Paiement échoué' },
  SYSTEM:          { icon: Bell,           colorClass: 'bg-gray-100 text-gray-500',   label: 'Système' },
  // fallback for old/unknown types
  default:         { icon: Bell,           colorClass: 'bg-orange-50 text-[#FF9F1C]', label: 'Notification' },
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Il y a ${diffH}h`;
  if (diffH < 48) return 'Hier';
  return format(date, 'd MMM', { locale: fr });
}

import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/features/notifications/api';

export function Notifications({ onBack }: NotificationsProps) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'all' | 'unread'>('all');

  const { data, isLoading } = useNotifications(50, activeTab === 'unread');
  const notifications = data?.data ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  /** Navigate to the relevant screen based on notification type */
  const handleNotifPress = (notif: typeof notifications[number]) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);

    const d = notif.data as any;
    switch (notif.type) {
      case 'FRIEND_REQUEST':
        navigate('/friend-requests');
        break;
      case 'FRIEND_ACCEPTED':
        if (d?.receiverId) navigate(`/profile`);
        break;
      case 'EVENT_INVITE':
      case 'EVENT_UPDATE':
      case 'EVENT_CANCELLED':
      case 'JOIN_REQUEST':
      case 'JOIN_ACCEPTED':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'PAYMENT_SUCCESS':
        if (d?.bookingId) navigate(`/payments/${d.bookingId}`);
        else if (d?.eventId) navigate(`/events/${d.eventId}`);
        break;
      case 'NEW_MESSAGE':
        navigate('/messages');
        break;
      default:
        break;
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">

      {/* Header */}
      <div className="bg-white px-5 pt-4 pt-safe-4 pb-0 border-b border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="w-9 h-9 bg-gray-100 rounded-full flex items-center justify-center"
            >
              <ChevronLeft className="w-5 h-5 text-gray-700" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Notifications</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-gray-400">{unreadCount} non lu{unreadCount > 1 ? 'es' : ''}</p>
              )}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllReadMutation.mutate()}
              disabled={markAllReadMutation.isPending}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#FF9F1C] px-3 py-1.5 bg-orange-50 rounded-full"
            >
              {markAllReadMutation.isPending
                ? <Loader2 className="w-3 h-3 animate-spin" />
                : <Check className="w-3 h-3" />}
              Tout lire
            </button>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1">
          {(['all', 'unread'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-semibold rounded-t-xl transition-colors border-b-2 ${
                activeTab === tab
                  ? 'text-[#FF9F1C] border-[#FF9F1C] bg-white'
                  : 'text-gray-400 border-transparent'
              }`}
            >
              {tab === 'all' ? 'Toutes' : 'Non lues'}
              {tab === 'unread' && unreadCount > 0 && (
                <span className="ml-1.5 bg-[#FF9F1C] text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 rounded-lg w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: 'rgba(255,159,28,0.08)' }}
            >
              <Bell className="w-8 h-8" style={{ color: '#FF9F1C' }} />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 mb-1">Aucune notification</h3>
            <p className="text-[13px] text-gray-400">
              {activeTab === 'unread' ? 'Vous avez tout lu !' : 'Vos notifications apparaîtront ici.'}
            </p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {notifications.map((notif) => {
              const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default;
              const Icon = cfg.icon;
              // Detect if this notification is navigable
              const isNavigable = [
                'FRIEND_REQUEST', 'FRIEND_ACCEPTED',
                'EVENT_INVITE', 'EVENT_UPDATE', 'EVENT_CANCELLED',
                'JOIN_REQUEST', 'JOIN_ACCEPTED',
                'PAYMENT_SUCCESS', 'NEW_MESSAGE',
              ].includes(notif.type);

              return (
                <button
                  key={notif.id}
                  onClick={() => handleNotifPress(notif)}
                  className={`w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] shadow-sm ${
                    notif.isRead ? 'bg-white' : 'bg-white border-l-4 border-[#FF9F1C]'
                  }`}
                >
                  {/* Icon */}
                  <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-0.5">
                      <p className={`text-[14px] leading-snug ${notif.isRead ? 'text-gray-700' : 'font-semibold text-gray-900'}`}>
                        {notif.title}
                      </p>
                      <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {timeAgo(notif.createdAt)}
                      </span>
                    </div>
                    <p className="text-[13px] text-gray-500 leading-snug line-clamp-2">{notif.body}</p>
                    {isNavigable && (
                      <p className="text-[11px] text-[#FF9F1C] font-medium mt-1">
                        {notif.type === 'FRIEND_REQUEST' ? 'Appuyez pour répondre →' :
                         notif.type === 'PAYMENT_SUCCESS' ? 'Voir le reçu →' :
                         notif.type === 'NEW_MESSAGE' ? 'Ouvrir →' : 'Voir →'}
                      </p>
                    )}
                  </div>

                  {/* Unread dot */}
                  {!notif.isRead && (
                    <div className="w-2.5 h-2.5 bg-[#FF9F1C] rounded-full flex-shrink-0 mt-1" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}


import { useNavigate } from 'react-router';
import { ChevronLeft, Heart, MessageCircle, UserPlus, Calendar, DollarSign, Bell, Check, Loader2, Users, CheckCircle, AlertCircle, ChevronRight, Archive } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/features/notifications/api';
import {
  groupNotificationsByType,
  getNotificationsForType,
  filterActiveNotifications,
  NOTIFICATION_TTL_MS,
} from '@/lib/notifications-group';

interface NotificationsProps {
  onBack: () => void;
}

const TYPE_CONFIG: Record<string, { icon: typeof Bell; colorClass: string; label: string }> = {
  EVENT_INVITE:    { icon: Calendar,       colorClass: 'bg-orange-50 text-action-primary', label: 'Invitation' },
  EVENT_UPDATE:    { icon: Calendar,       colorClass: 'bg-orange-50 text-action-primary',    label: 'Mise à jour événement' },
  EVENT_CANCELLED: { icon: Calendar,       colorClass: 'bg-red-50 text-red-500',      label: 'Événement annulé' },
  JOIN_REQUEST:    { icon: Users,          colorClass: 'bg-orange-50 text-action-primary', label: 'Demande de participation' },
  JOIN_ACCEPTED:   { icon: CheckCircle,    colorClass: 'bg-green-50 text-green-500',  label: 'Participation acceptée' },
  NEW_MESSAGE:     { icon: MessageCircle,  colorClass: 'bg-orange-50 text-action-primary', label: 'Nouveau message' },
  FRIEND_REQUEST:  { icon: UserPlus,       colorClass: 'bg-orange-50 text-action-primary',    label: "Demande d'ami" },
  FRIEND_ACCEPTED: { icon: Heart,          colorClass: 'bg-pink-50 text-pink-500',    label: 'Ami accepté' },
  PAYMENT_SUCCESS: { icon: DollarSign,     colorClass: 'bg-green-50 text-green-500',  label: 'Paiement réussi' },
  PAYMENT_FAILED:  { icon: AlertCircle,    colorClass: 'bg-red-50 text-red-500',      label: 'Paiement échoué' },
  SYSTEM:          { icon: Bell,           colorClass: 'bg-gray-100 text-gray-500',   label: 'Système' },
  default:         { icon: Bell,           colorClass: 'bg-orange-50 text-action-primary', label: 'Notification' },
};

const TYPE_LABELS = Object.fromEntries(
  Object.entries(TYPE_CONFIG).map(([k, v]) => [k, v.label]),
) as Record<string, string>

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

export function Notifications({ onBack }: NotificationsProps) {
  const navigate = useNavigate();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const [archivedTypes, setArchivedTypes] = useState<Set<string>>(new Set());
  const [archivedIds, setArchivedIds] = useState<Set<string>>(new Set());

  const { data, isLoading } = useNotifications(100, false);
  const allNotifications = data?.data ?? [];
  const activeNotifications = useMemo(
    () => filterActiveNotifications(allNotifications).filter(n => !archivedIds.has(n.id) && !archivedTypes.has(n.type)),
    [allNotifications, archivedIds, archivedTypes],
  );
  const unreadCount = activeNotifications.filter((n) => !n.isRead).length;

  const groups = useMemo(
    () => groupNotificationsByType(activeNotifications, { ...TYPE_LABELS, default: 'Notification' }),
    [activeNotifications],
  );

  const typeNotifications = selectedType
    ? getNotificationsForType(activeNotifications, selectedType)
    : [];

  const markReadMutation = useMarkNotificationAsRead();
  const markAllReadMutation = useMarkAllNotificationsAsRead();

  const handleNotifPress = (notif: (typeof activeNotifications)[number]) => {
    if (!notif.isRead) markReadMutation.mutate(notif.id);

    const d = notif.data as Record<string, string> | undefined;
    switch (notif.type) {
      case 'FRIEND_REQUEST':
        navigate('/friend-requests');
        break;
      case 'FRIEND_ACCEPTED':
        navigate('/profile');
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

  const selectedCfg = selectedType ? (TYPE_CONFIG[selectedType] ?? TYPE_CONFIG.default) : null;

  return (
    <div className="w-full h-full flex flex-col bg-[#F8F7FF] dark:bg-[#111111]">

      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-4 pt-safe-4 pb-0 border-b border-gray-100 dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                if (selectedType) setSelectedType(null);
                else onBack();
              }}
              className="w-10 h-10 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform"
            >
              <ChevronLeft className="w-6 h-6 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
            </button>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">
                {selectedType && selectedCfg ? selectedCfg.label : 'Notifications'}
              </h1>
              {unreadCount > 0 && !selectedType && (
                <p className="text-xs text-gray-400">{unreadCount} non lu{unreadCount > 1 ? 'es' : ''}</p>
              )}
            </div>
          </div>
          {(groups.length > 0 || typeNotifications.length > 0) && (
            <button
              onClick={() => {
                markAllReadMutation.mutate();
                if (selectedType) {
                  setArchivedTypes(prev => new Set(prev).add(selectedType));
                  setSelectedType(null);
                } else {
                  setArchivedTypes(new Set([...Array.from(archivedTypes), ...groups.map(g => g.type)]));
                }
              }}
              className={`text-[13px] font-semibold transition-colors ${unreadCount > 0 ? 'text-action-primary' : 'text-gray-500'}`}
            >
              Tout effacer
            </button>
          )}
        </div>

        {!selectedType && (
          <p className="text-[11px] text-gray-400 pb-3 px-1">
            Les notifications de plus de {Math.round(NOTIFICATION_TTL_MS / (24 * 60 * 60 * 1000))} jours sont masquées.
          </p>
        )}
      </div>

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
        ) : selectedType ? (
          typeNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
              <p className="text-[13px] text-gray-400">Aucune notification dans cette catégorie.</p>
            </div>
          ) : (
            <div className="p-4 space-y-2">
              {typeNotifications.map((notif) => {
                const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default;
                const Icon = cfg.icon;
                return (
                  <button
                    key={notif.id}
                    onClick={() => handleNotifPress(notif)}
                    className={`w-full flex items-start gap-3 p-4 rounded-2xl text-left transition-all active:scale-[0.98] shadow-sm ${
                      notif.isRead ? 'bg-white dark:bg-[#1A1A1A]' : 'bg-white dark:bg-[#1A1A1A] border-l-4 border-action-primary'
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.colorClass}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-0.5">
                        <p className={`text-[14px] leading-snug ${notif.isRead ? 'text-gray-700' : 'font-semibold text-gray-900 dark:text-white'}`}>
                          {notif.title}
                        </p>
                        <span className="text-[11px] text-gray-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                          {timeAgo(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-[13px] text-gray-500 leading-snug line-clamp-2">{notif.body}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 mt-1">
                      {!notif.isRead && (
                        <div className="w-2.5 h-2.5 bg-action-primary rounded-full" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchivedIds(prev => new Set(prev).add(notif.id));
                        }}
                        className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                        title="Archiver"
                      >
                        <Archive className="w-4 h-4" />
                      </button>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : groups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <div
              className="w-16 h-16 rounded-2xl mb-4 flex items-center justify-center"
              style={{ background: 'rgba(255,159,28,0.08)' }}
            >
              <Bell className="w-8 h-8" style={{ color: '#FF7A00' }} />
            </div>
            <h3 className="text-[15px] font-bold text-gray-900 dark:text-white mb-1">Aucune notification</h3>
            <p className="text-[13px] text-gray-400">Vos notifications récentes apparaîtront ici.</p>
          </div>
        ) : (
          <div className="p-4 space-y-2">
            {groups.map((group) => {
              const cfg = TYPE_CONFIG[group.type] ?? TYPE_CONFIG.default;
              const Icon = cfg.icon;
              return (
                <button
                  key={group.type}
                  onClick={() => setSelectedType(group.type)}
                  className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-[#1A1A1A] text-left shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.colorClass}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[15px] font-bold text-gray-900 dark:text-white">{group.label}</p>
                      {group.unreadCount > 0 && (
                        <span className="bg-action-primary text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                          {group.unreadCount}
                        </span>
                      )}
                    </div>
                    <p className="text-[13px] text-gray-500 truncate mt-0.5">{group.latestTitle}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {group.count} notification{group.count > 1 ? 's' : ''} · {timeAgo(group.latestAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <ChevronRight className="w-5 h-5 text-gray-300 flex-shrink-0" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setArchivedTypes(prev => new Set(prev).add(group.type));
                      }}
                      className="p-1.5 text-gray-300 hover:text-red-500 transition-colors rounded-full hover:bg-red-50"
                      title="Archiver"
                    >
                      <Archive className="w-4 h-4" />
                    </button>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router';
import { useState, useMemo, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, useMarkNotificationAsRead, useMarkAllNotificationsAsRead } from '@/features/notifications/api';
import { filterActiveNotifications } from '@/lib/notifications-group';
import { UserAdd01Icon, WalletDone02Icon, WalletAdd01Icon, TickDouble01Icon, Settings03Icon, Notification01Icon, UserMultiple02Icon } from 'hugeicons-react';
import { TopBar } from '@/components/ui/TopBar';

interface NotificationsProps {
  onBack: () => void;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string }> = {
  EVENT_INVITE:    { icon: UserAdd01Icon,    label: 'Invitation' },
  EVENT_UPDATE:    { icon: Notification01Icon, label: 'Mise à jour événement' },
  EVENT_CANCELLED: { icon: Notification01Icon, label: 'Événement annulé' },
  JOIN_REQUEST:    { icon: UserMultiple02Icon, label: 'Demande de participation' },
  JOIN_ACCEPTED:   { icon: TickDouble01Icon, label: 'Participation acceptée' },
  NEW_MESSAGE:     { icon: Notification01Icon, label: 'Nouveau message' },
  FRIEND_REQUEST:  { icon: UserAdd01Icon,    label: "Demande d'ami" },
  FRIEND_ACCEPTED: { icon: TickDouble01Icon, label: 'Ami accepté' },
  PAYMENT_SUCCESS: { icon: TickDouble01Icon, label: 'Paiement réussi' },
  PAYMENT_FAILED:  { icon: Notification01Icon, label: 'Paiement échoué' },
  POOL_UNLOCK_REQUEST: { icon: WalletDone02Icon, label: 'Demande de validation' },
  POOL_NEW: { icon: WalletAdd01Icon, label: 'Nouvelle cagnotte' },
  POOL_UNLOCK_APPROVED: { icon: TickDouble01Icon, label: 'Déblocage de fonds approuvé' },
  POOL_VOTE_STARTED: { icon: Settings03Icon, label: 'Vote des validateurs' },
  SYSTEM:          { icon: Notification01Icon, label: 'Système' },
  JOIN_CONFIRMED:  { icon: TickDouble01Icon, label: 'Participation confirmée' },
  EVENT_REVIEW_REQUEST: { icon: Notification01Icon, label: 'Avis demandé' },
  default:         { icon: Notification01Icon, label: 'Notification' },
};

function getActionLabel(type: string) {
  switch(type) {
    case 'EVENT_INVITE': return "Voir l'événement";
    case 'POOL_UNLOCK_REQUEST': return "Voir la demande";
    case 'POOL_VOTE_STARTED': return "Ouvrir le vote";
    case 'NEW_MESSAGE': return "Ouvrir le chat";
    case 'FRIEND_REQUEST': return "Voir la demande";
    case 'POOL_NEW': return "Consulter la cagnotte";
    case 'EVENT_REVIEW_REQUEST': return "Laisser un avis";
    default: return "Voir les détails";
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
  // On exclut NEW_MESSAGE de l'affichage in-app (les push notifs backend ne sont pas affectées)
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

  // Auto-correct backend unreadCount if there are no visible active unread notifications
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
      case 'POOL_UNLOCK_REQUEST':
        if (d?.eventId) navigate(`/events/${d.eventId}`);
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

  if (selectedNotification) {
    const cfg = TYPE_CONFIG[selectedNotification.type] ?? TYPE_CONFIG.default;
    return (
      <div className="fixed inset-0 z-50 bg-[#F8F7FF] dark:bg-[#09090b] flex flex-col animate-in slide-in-from-right-8 duration-200">
        <TopBar 
          title={cfg.label} 
          onBack={() => setSelectedNotification(null)}
          containerClassName="bg-white dark:bg-[#09090b] border-b border-transparent pt-safe-4"
        />
        <div className="flex-1 overflow-y-auto p-4 pt-6 bg-[#F8F7FF] dark:bg-[#111111]">
          <p className="font-sans text-[14px] leading-[20px] text-[#404040] dark:text-gray-300">
            {selectedNotification.body}
          </p>
        </div>
        <div className="p-4 pb-safe-4 bg-white dark:bg-[#09090b]">
          <button 
            onClick={() => handleAction(selectedNotification)}
            className="w-full h-[52px] bg-[#FF7A00] text-white rounded-full font-semibold text-[15px] flex items-center justify-center hover:bg-[#e66a00] transition-colors"
          >
            {getActionLabel(selectedNotification.type)}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white dark:bg-[#111111]">
      <TopBar 
        title="Notifications" 
        onBack={onBack}
        containerClassName="pt-safe-4"
      />

      <div className="flex items-center gap-2 px-4 mb-2 mt-2">
        <button 
          onClick={() => setActiveTab('all')}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
            activeTab === 'all' 
              ? 'bg-[#FFF2E5] text-[#FF7A00]' 
              : 'bg-transparent text-[#A3A3A3]'
          }`}
        >
          Toutes
        </button>
        <button 
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-1.5 rounded-full text-[13px] font-medium transition-colors ${
            activeTab === 'unread' 
              ? 'bg-[#FFF2E5] text-[#FF7A00]' 
              : 'bg-transparent text-[#A3A3A3]'
          }`}
        >
          Non lues {activeUnreadCount > 0 ? `(${activeUnreadCount.toString().padStart(2, '0')})` : ''}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto flex flex-col items-center pb-safe-4 px-4 gap-2" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="w-full flex flex-col gap-3 py-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-gray-50 dark:bg-[#1A1A1A] rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-6 h-6 rounded-md bg-gray-200 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-1/3" />
                  <div className="h-3 bg-gray-100 rounded-lg w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : displayedNotifications.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center w-full text-center py-20">
            <svg className="mb-4" width="128" height="112" viewBox="0 0 128 112" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M119.218 6.61914H16.4822C11.632 6.61914 7.70007 10.551 7.70007 15.4013V80.0992C7.70007 84.9495 11.632 88.8813 16.4822 88.8813H119.218C124.068 88.8813 128 84.9495 128 80.0992V15.4013C128 10.551 124.068 6.61914 119.218 6.61914Z" fill="#FF7A00"/>
              <path d="M4.89292 5.67035C4.68722 5.66948 4.49008 5.58782 4.34403 5.44296L2.93262 4.03937C2.78497 3.89172 2.70201 3.69147 2.70201 3.48265C2.70201 3.27384 2.78497 3.07357 2.93262 2.92592C3.08027 2.77827 3.28053 2.69531 3.48934 2.69531C3.69815 2.69531 3.89842 2.77827 4.04607 2.92592L5.44964 4.33734C5.59569 4.48426 5.67767 4.683 5.67767 4.89015C5.67767 5.0973 5.59569 5.29604 5.44964 5.44296C5.37638 5.51563 5.28948 5.57312 5.19395 5.61214C5.09841 5.65116 4.99612 5.67094 4.89292 5.67035Z" fill="#FF7A00"/>
              <path d="M2.76795 10.5956H0.784122C0.57616 10.5956 0.376715 10.513 0.229663 10.3659C0.082612 10.2189 0 10.0194 0 9.81147C0 9.6035 0.082612 9.40406 0.229663 9.25701C0.376715 9.10996 0.57616 9.02734 0.784122 9.02734H2.76795C2.97591 9.02734 3.17536 9.10996 3.32241 9.25701C3.46946 9.40406 3.55207 9.6035 3.55207 9.81147C3.55207 10.0194 3.46946 10.2189 3.32241 10.3659C3.17536 10.513 2.97591 10.5956 2.76795 10.5956Z" fill="#FF7A00"/>
              <path d="M9.88778 3.5536C9.68899 3.55408 9.49743 3.47904 9.35186 3.34366C9.20629 3.20828 9.11758 3.02266 9.10366 2.82436L8.96251 0.84053C8.95505 0.737504 8.96802 0.634027 9.00067 0.536027C9.03332 0.438027 9.085 0.347439 9.15277 0.269476C9.22053 0.191513 9.30303 0.127709 9.39553 0.0817252C9.48803 0.0357415 9.58869 0.00848605 9.69175 0.00152549C9.89853 -0.0113857 10.102 0.0580588 10.2578 0.194696C10.4135 0.331334 10.5088 0.524052 10.5229 0.730753L10.6719 2.71458C10.6794 2.81761 10.6664 2.92109 10.6338 3.0191C10.6011 3.1171 10.5494 3.20768 10.4817 3.28565C10.4139 3.36361 10.3314 3.42741 10.2389 3.4734C10.1464 3.51938 10.0457 3.54664 9.94267 3.5536H9.88778Z" fill="#FF7A00"/>
              <path d="M76.6244 80.4219L108.17 111.959V80.4219H76.6244Z" fill="#FF7A00"/>
              <path d="M85.2732 66.6044L83.705 59.9472C83.309 58.1972 83.309 56.3808 83.705 54.6308L85.8849 45.1508C86.7767 41.1082 86.2938 36.8835 84.5126 33.1464C82.7314 29.4093 79.7539 26.3737 76.052 24.5206C76.1214 24.3461 76.1817 24.1681 76.2323 23.9874C76.361 23.4123 76.3752 22.8174 76.2741 22.2369C76.1729 21.6563 75.9584 21.1013 75.6427 20.6036C75.3271 20.106 74.9165 19.6753 74.4344 19.3363C73.9524 18.9973 73.4083 18.7566 72.8332 18.6279C72.2581 18.4992 71.6632 18.485 71.0826 18.5861C70.5021 18.6873 69.9471 18.9018 69.4494 19.2175C68.9518 19.5331 68.5211 19.9437 68.1821 20.4258C67.8431 20.9078 67.6024 21.452 67.4737 22.0271C67.4347 22.2103 67.4111 22.3966 67.4031 22.5838C63.2648 22.6809 59.2772 24.1557 56.0716 26.7747C52.8661 29.3937 50.6258 33.0072 49.7055 37.043L47.5805 46.5309C47.1902 48.2777 46.4131 49.9149 45.3066 51.3218L41.0801 56.6931C40.6667 57.22 40.3934 57.8429 40.2857 58.5039C40.1779 59.1648 40.2392 59.8423 40.4639 60.4732C40.6885 61.1041 41.0692 61.6678 41.5705 62.1119C42.0717 62.5561 42.6772 62.8661 43.3306 63.0131L80.5764 71.3561C81.2275 71.4968 81.9035 71.471 82.542 71.2811C83.1805 71.0911 83.7607 70.7431 84.229 70.2694C84.6973 69.7956 85.0384 69.2114 85.221 68.5708C85.4035 67.9301 85.4215 67.2538 85.2732 66.6044Z" fill="white"/>
              <path d="M57.1468 68.6586C56.8635 68.5961 56.5692 68.6045 56.2899 68.6829C56.0105 68.7613 55.7549 68.9074 55.5455 69.1083C55.3362 69.3091 55.1796 69.5585 55.0896 69.8343C54.9996 70.1101 54.979 70.4038 55.0297 70.6895C55.2435 71.9494 55.8276 73.1172 56.7074 74.0441C57.5872 74.971 58.723 75.6151 59.9701 75.8943C61.2173 76.1735 62.5192 76.0751 63.7103 75.6119C64.9013 75.1486 65.9275 74.3412 66.6582 73.2927C66.8251 73.0564 66.9314 72.7827 66.9675 72.4956C67.0037 72.2086 66.9688 71.917 66.8657 71.6467C66.7627 71.3763 66.5948 71.1354 66.3767 70.9453C66.1587 70.7551 65.8972 70.6215 65.6153 70.5562L57.1468 68.6586Z" fill="white"/>
              <path d="M28.542 55.4628C28.3477 55.4643 28.1562 55.417 27.9849 55.3252C27.8137 55.2334 27.6682 55.1001 27.5619 54.9375C23.8584 49.3889 22.5106 42.5965 23.815 36.0543C25.1193 29.5121 28.9689 23.7559 34.517 20.0519C34.777 19.8793 35.0949 19.817 35.4007 19.8788C35.7066 19.9405 35.9754 20.1212 36.148 20.3812C36.3206 20.6412 36.3829 20.959 36.3211 21.2649C36.2594 21.5708 36.0786 21.8396 35.8187 22.0122C30.7961 25.3762 27.3143 30.5963 26.1381 36.5259C24.9618 42.4554 26.1875 48.6094 29.5457 53.6358C29.7192 53.8948 29.7827 54.212 29.7225 54.5178C29.6622 54.8236 29.483 55.093 29.2242 55.2668C29.022 55.3999 28.784 55.4683 28.542 55.4628Z" fill="white"/>
              <path d="M33.5212 52.122C33.3285 52.1208 33.139 52.0723 32.9695 51.9807C32.8 51.8891 32.6555 51.7572 32.5489 51.5967C29.7301 47.3699 28.7042 42.1971 29.6966 37.2145C30.689 32.2319 33.6185 27.8469 37.8417 25.0228C37.9704 24.9368 38.1148 24.877 38.2666 24.8468C38.4185 24.8167 38.5747 24.8167 38.7266 24.8469C38.8784 24.8771 39.0228 24.9369 39.1515 25.0229C39.2801 25.109 39.3906 25.2195 39.4766 25.3482C39.5626 25.4769 39.6224 25.6213 39.6526 25.7731C39.6827 25.9249 39.6827 26.0812 39.6525 26.233C39.6223 26.3849 39.5625 26.5292 39.4764 26.6579C39.3904 26.7866 39.2799 26.8971 39.1512 26.9831C35.4444 29.4569 32.872 33.3018 32 37.6722C31.128 42.0425 32.0278 46.5802 34.5014 50.2872C34.6748 50.5462 34.7384 50.8634 34.6781 51.1692C34.6178 51.475 34.4386 51.7444 34.1799 51.9182C33.9848 52.0487 33.7559 52.1195 33.5212 52.122Z" fill="white"/>
              <path d="M38.5082 48.7888C38.316 48.7898 38.1265 48.7431 37.9568 48.6527C37.787 48.5624 37.6424 48.4313 37.5359 48.2713C36.5752 46.8327 35.9076 45.2189 35.5713 43.522C35.235 41.8252 35.2365 40.0787 35.5759 38.3825C35.9153 36.6862 36.5859 35.0736 37.5492 33.6368C38.5125 32.2 39.7497 30.9672 41.1899 30.0091C41.4489 29.8482 41.7601 29.7942 42.0581 29.8584C42.3561 29.9226 42.6176 30.0999 42.7873 30.3531C42.9571 30.6062 43.022 30.9154 42.9683 31.2155C42.9146 31.5155 42.7465 31.783 42.4994 31.9615C41.3181 32.7501 40.3037 33.7637 39.5142 34.9444C38.7247 36.1251 38.1756 37.4498 37.8982 38.8428C37.6207 40.2357 37.6205 41.6697 37.8973 43.0628C38.1742 44.4559 38.7229 45.7808 39.5119 46.9618C39.6833 47.2214 39.7457 47.538 39.6855 47.8432C39.6254 48.1484 39.4475 48.4177 39.1904 48.5928C38.9882 48.7259 38.7503 48.7943 38.5082 48.7888Z" fill="white"/>
              <path d="M96.3529 71.9998C96.0899 71.9991 95.8347 71.9104 95.6281 71.7477C95.4214 71.585 95.2753 71.3577 95.213 71.1022C95.1507 70.8467 95.1758 70.5777 95.2844 70.3381C95.3929 70.0986 95.5787 69.9023 95.8118 69.7807C101.184 67.005 105.234 62.2096 107.072 56.4487C108.91 50.6879 108.385 44.4329 105.613 39.0588C105.529 38.9208 105.474 38.767 105.452 38.6069C105.43 38.4467 105.441 38.2837 105.485 38.1281C105.528 37.9724 105.604 37.8275 105.706 37.7022C105.808 37.5769 105.935 37.4741 106.079 37.4001C106.222 37.326 106.38 37.2825 106.541 37.272C106.702 37.2615 106.864 37.2844 107.016 37.3393C107.168 37.3941 107.307 37.4797 107.425 37.5908C107.542 37.7018 107.636 37.8358 107.699 37.9846C109.213 40.9212 110.134 44.1274 110.409 47.42C110.684 50.7127 110.308 54.0272 109.301 57.1743C108.295 60.3214 106.679 63.2394 104.544 65.7617C102.41 68.284 99.7997 70.361 96.8626 71.8743C96.7036 71.952 96.5298 71.9948 96.3529 71.9998Z" fill="white"/>
              <path d="M93.6006 66.6757C93.3376 66.6751 93.0824 66.5863 92.8758 66.4236C92.6692 66.2609 92.523 66.0337 92.4607 65.7781C92.3984 65.5226 92.4236 65.2536 92.5321 65.0141C92.6407 64.7745 92.8264 64.5782 93.0596 64.4566C95.0217 63.445 96.7653 62.0566 98.1904 60.3706C99.6155 58.6846 100.694 56.7343 101.365 54.631C102.036 52.5278 102.285 50.313 102.099 48.1132C101.913 45.9135 101.296 43.772 100.281 41.8112C100.138 41.5336 100.111 41.2103 100.205 40.9125C100.3 40.6147 100.509 40.3668 100.787 40.2234C101.065 40.0799 101.388 40.0525 101.686 40.1474C101.984 40.2422 102.231 40.4515 102.375 40.7291C103.531 42.9644 104.234 45.4055 104.446 47.9129C104.658 50.4203 104.373 52.9449 103.609 55.3422C102.844 57.7396 101.614 59.9627 99.9898 61.8845C98.3654 63.8063 96.3782 65.3891 94.1417 66.5424C93.9753 66.6313 93.7893 66.6772 93.6006 66.6757Z" fill="white"/>
              <path d="M90.8483 61.3512C90.5863 61.3469 90.333 61.2558 90.1283 61.0922C89.9236 60.9285 89.779 60.7016 89.7171 60.4469C89.6552 60.1922 89.6796 59.9242 89.7864 59.6848C89.8932 59.4455 90.0764 59.2483 90.3073 59.1243C91.5698 58.4746 92.6917 57.5823 93.6088 56.4985C94.526 55.4147 95.2205 54.1607 95.6524 52.8082C96.0843 51.4556 96.2452 50.0312 96.1259 48.6164C96.0066 47.2016 95.6094 45.8243 94.9572 44.5632C94.8137 44.2855 94.7863 43.9623 94.8812 43.6645C94.976 43.3667 95.1853 43.1188 95.4629 42.9753C95.7405 42.8318 96.0638 42.8045 96.3616 42.8993C96.6594 42.9942 96.9073 43.2034 97.0507 43.4811C98.6466 46.5866 98.9451 50.1983 97.8807 53.5237C96.8164 56.849 94.4762 59.6162 91.3737 61.2179C91.2111 61.3018 91.0313 61.3474 90.8483 61.3512Z" fill="white"/>
            </svg>
            <h3 className="font-[Poppins] font-bold text-[18px] text-gray-900 dark:text-white mb-2">Aucune notification</h3>
            <p className="font-sans text-[13px] text-[#404040] dark:text-gray-400">Vos notifications apparaîtront ici.</p>
          </div>
        ) : (
          <div className="w-full flex flex-col pt-2">
            {displayedNotifications.map((notif, index) => {
              const cfg = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.default;
              const Icon = cfg.icon;
              return (
                <div key={notif.id} className="w-full flex flex-col">
                  <button
                    onClick={() => {
                      if (!notif.isRead) markReadMutation.mutate(notif.id);
                      setSelectedNotification(notif);
                    }}
                    className="w-full flex flex-row items-start px-2 py-3 gap-[10px] relative transition-transform active:bg-gray-50 dark:active:bg-[#18181b]"
                  >
                    <div className="flex flex-row items-center justify-center w-6 h-6 rounded-[6px] shrink-0 mt-0.5">
                      <Icon className="w-5 h-5 text-[#A3A3A3]" />
                    </div>
                    <div className="flex flex-col items-start gap-[2px] flex-1">
                      <div className="flex flex-row items-center gap-[4px] w-full pr-4">
                        <span className="font-[Poppins] font-medium text-[13px] leading-[20px] text-[#1B1818] dark:text-white">
                          {cfg.label}
                        </span>
                      </div>
                      <span className="font-sans font-normal text-[12px] leading-[16px] text-[#404040] dark:text-gray-400 text-left line-clamp-2 pr-2">
                        {notif.body}
                      </span>
                    </div>
                    {!notif.isRead && (
                      <div className="absolute w-[6px] h-[6px] bg-[#FF7A00] rounded-full right-2 top-4" />
                    )}
                  </button>
                  {index < displayedNotifications.length - 1 && (
                    <div className="w-full h-[0.5px] bg-[#E7E4E4] dark:bg-[#2A2A2A] my-1" />
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

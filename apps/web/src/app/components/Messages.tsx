import { useState, useMemo, memo, useEffect } from 'react';
import { Search, X, Pin, PinOff, Bell, BellOff, Circle, Trash2, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useConversations } from '@/features/chat/api';
import { useChatSocket } from '@/features/chat/hooks/useChatSocket';
import { NewConversationModal } from '@/features/chat/components/NewConversationModal';
import { AddFriendsModal } from '@/features/users/components/AddFriendsModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { useAuthStore } from '@/stores/auth.store';
import PullToRefresh from 'react-simple-pull-to-refresh';

interface MessagesProps {}



export function Messages(_props: MessagesProps) {
  const navigate = useNavigate();
  useChatSocket();
  const { data: conversations, isLoading, refetch } = useConversations();
  const [showNewConv, setShowNewConv] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'friends' | 'groups'>('all');

  const user = useAuthStore((s) => s.user);

  const [pinnedConvs, setPinnedConvs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('letsout_pinned_convs') || '[]'); } catch { return []; }
  });
  const [mutedConvs, setMutedConvs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('letsout_muted_convs') || '[]'); } catch { return []; }
  });
  const [hiddenConvs, setHiddenConvs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('letsout_hidden_convs') || '[]'); } catch { return []; }
  });
  const [forceReadConvs, setForceReadConvs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('letsout_forceread_convs') || '[]'); } catch { return []; }
  });
  const [forceUnreadConvs, setForceUnreadConvs] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('letsout_forceunread_convs') || '[]'); } catch { return []; }
  });

  const togglePin = (convId: string) => {
    setPinnedConvs(prev => {
      const newPins = prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId];
      localStorage.setItem('letsout_pinned_convs', JSON.stringify(newPins));
      return newPins;
    });
    setContextMenu(null);
  };

  const toggleMute = (convId: string) => {
    setMutedConvs(prev => {
      const newMutes = prev.includes(convId) ? prev.filter(id => id !== convId) : [...prev, convId];
      localStorage.setItem('letsout_muted_convs', JSON.stringify(newMutes));
      return newMutes;
    });
    setContextMenu(null);
  };

  const hideConversation = (convId: string) => {
    setHiddenConvs(prev => {
      const newHidden = [...prev, convId];
      localStorage.setItem('letsout_hidden_convs', JSON.stringify(newHidden));
      return newHidden;
    });
    setContextMenu(null);
  };

  const toggleReadStatus = (convId: string, currentUnread: number) => {
    const isCurrentlyUnread = forceUnreadConvs.includes(convId) || (currentUnread > 0 && !forceReadConvs.includes(convId));
    
    if (isCurrentlyUnread) {
      // Mark as read
      setForceReadConvs(prev => { const n = [...prev, convId]; localStorage.setItem('letsout_forceread_convs', JSON.stringify(n)); return n; });
      setForceUnreadConvs(prev => { const n = prev.filter(id => id !== convId); localStorage.setItem('letsout_forceunread_convs', JSON.stringify(n)); return n; });
    } else {
      // Mark as unread
      setForceUnreadConvs(prev => { const n = [...prev, convId]; localStorage.setItem('letsout_forceunread_convs', JSON.stringify(n)); return n; });
      setForceReadConvs(prev => { const n = prev.filter(id => id !== convId); localStorage.setItem('letsout_forceread_convs', JSON.stringify(n)); return n; });
    }
    setContextMenu(null);
  };

  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, convId: string, unread: number } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    window.addEventListener('click', closeMenu);
    return () => window.removeEventListener('click', closeMenu);
  }, []);

  const displayConversations = useMemo(() => {
    return (conversations && conversations.length > 0)
      ? conversations.map((conv: any) => {
          let name = conv.name || 'Conversation';
          let avatarUrl = conv.avatarUrl || null;
          
          if (!conv.isGroup) {
            const otherMember = conv.members?.find((m: any) => m.userId !== user?.id)?.user;
            if (otherMember?.profile) {
              name = otherMember.profile.displayName || name;
              avatarUrl = otherMember.profile.avatarUrl || avatarUrl;
            }
          }

          const lastMessage = conv.messages?.[0];
          let lastMsg = lastMessage?.content || 'Nouvelle conversation';
          let lastMsgPrefix = '';

          if (lastMessage?.type === 'IMAGE') lastMsg = '📷 Photo';
          else if (lastMessage?.type === 'AUDIO') lastMsg = '🎙️ Audio';
          else if (lastMessage?.type === 'VIDEO') lastMsg = '🎥 Vidéo';
          else if (conv.isGroup && lastMessage?.sender?.profile?.displayName) {
            lastMsgPrefix = lastMessage.sender.profile.displayName.split(' ')[0] + ': ';
          }

          let actualUnread = conv.unread || 0;
          if (forceReadConvs.includes(conv.id)) actualUnread = 0;
          if (forceUnreadConvs.includes(conv.id) && actualUnread === 0) actualUnread = 1;

          return {
            id: conv.id,
            isGroup: conv.isGroup,
            name,
            avatarUrl,
            lastMessageAt: conv.lastMessageAt,
            lastMsg,
            lastMsgPrefix,
            unread: actualUnread,
            isPinned: pinnedConvs.includes(conv.id),
            isMuted: mutedConvs.includes(conv.id),
          };
        })
        .filter(conv => !hiddenConvs.includes(conv.id))
        .sort((a, b) => {
          if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
          const timeA = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
          const timeB = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
          return timeB - timeA;
        })
      : [];
  }, [conversations, user?.id, pinnedConvs, mutedConvs, hiddenConvs, forceReadConvs, forceUnreadConvs]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return displayConversations;
    const q = searchQuery.toLowerCase();
    return displayConversations.filter(c => c.name.toLowerCase().includes(q));
  }, [displayConversations, searchQuery]);

  const groups = filtered.filter(c => c.isGroup);
  const directs = filtered.filter(c => !c.isGroup);
  // Apply tab filter
  const visibleConversations = useMemo(() => {
    if (activeFilter === 'groups') return groups;
    if (activeFilter === 'friends') return directs;
    return filtered;
  }, [activeFilter, filtered, groups, directs]);

  return (
    <div className="w-full h-full flex flex-col bg-[#FFFFFF] dark:bg-[#0a0a0b] font-poppins">

      {/* Header Section */}
      <div className="flex flex-col items-start w-full bg-[#FFFFFF] dark:bg-[#0a0a0b] sticky top-0 z-20">
        {/* App bar */}
        <div className="flex flex-row items-center px-[16px] pt-[calc(env(safe-area-inset-top)+12px)] pb-[12px] gap-[12px] w-full min-h-[56px] box-border">
          <h1 className="font-poppins font-medium text-[18px] leading-[20px] text-[#1B1818] dark:text-[#f5f5f5]">Messages</h1>
        </div>

        {visibleConversations.length > 0 || searchQuery ? (
          <div className="w-full flex flex-col gap-[12px] px-[16px] pb-[10px]">
            {/* Search */}
            <div className="w-full h-[36px] bg-[#FFFFFF] dark:bg-[#0a0a0b] opacity-80 border border-[#D4D4D4] rounded-[1000px] flex items-center gap-[8px] px-[12px] py-[8px] box-border">
              <Search className="w-[20px] h-[20px] text-[#A3A3A3] flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="flex-1 bg-transparent outline-none text-[14px] text-[#1B1818] dark:text-[#f5f5f5] placeholder:text-[#BDBDBD] font-['Inter_Display'] min-w-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-100 dark:bg-[#2A2A2A] dark:bg-[#2a2a2a] rounded-full transition-colors flex-shrink-0">
                  <X className="w-3.5 h-3.5 text-[#BDBDBD]" />
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="w-full flex items-center gap-[4px] overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
              {[
                { key: 'all' as const, label: 'Tout' },
                { key: 'friends' as const, label: 'Ami(e)s' },
                { key: 'groups' as const, label: 'Groupes' },
              ].map(tab => {
                const isActive = activeFilter === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveFilter(tab.key)}
                    className={`h-[32px] px-[12px] py-[8px] rounded-[1000px] flex items-center justify-center whitespace-nowrap transition-colors ${
                      isActive
                        ? 'bg-[#FFF2D3] text-[#FF7A00] dark:bg-[#FF7A00]/20'
                        : 'bg-[#FAFAFA] dark:bg-[#1A1A1A] text-[#56514F] dark:text-[#a3a3a3]'
                    }`}
                  >
                    <span className="font-poppins font-medium text-[12px] leading-[16px]">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
            </div>
          ) : null}
        </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-[16px] w-full" style={{ scrollbarWidth: 'none' }}>
        <PullToRefresh onRefresh={async () => { await refetch(); }} pullingContent="" refreshingContent={<div className="p-4 text-center text-[var(--color-text-secondary)] text-sm">Actualisation...</div>}>
          <div className="flex flex-col items-center w-full min-h-[100vh]">
            {isLoading ? (
              <div className="w-full flex flex-col gap-[16px] px-[16px]">
                {[1, 2, 3].map(i => (
                  <div key={i} className="w-full h-[48px] bg-white dark:bg-[#1A1A1A] rounded-2xl flex items-center gap-[8px] animate-pulse">
                    <div className="w-[48px] h-[48px] rounded-[24px] bg-gray-200 dark:bg-[#3A3A3A] flex-shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-200 dark:bg-[#3A3A3A] rounded-lg w-2/3" />
                      <div className="h-3 bg-gray-100 dark:bg-[#2A2A2A] dark:bg-[#2a2a2a] rounded-lg w-full" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <>
                {visibleConversations.length > 0 ? (
                  <div className="w-full flex flex-col gap-[16px] px-[16px]">
                    {visibleConversations.map(conv => (
                      <ConvItem 
                        key={conv.id} 
                        conv={conv} 
                        onNavigate={() => {
                          if (forceUnreadConvs.includes(conv.id)) toggleReadStatus(conv.id, 1);
                          navigate(`/chat/${conv.id}`)
                        }} 
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setContextMenu({ x: e.clientX, y: e.clientY, convId: conv.id, unread: conv.unread });
                        }}
                      />
                    ))}
                  </div>
                ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center gap-[20px] px-[16px] w-full max-w-[358px] pb-[100px]">
                {/* Chat Empty Illustration */}
                <div className="relative w-[256px] h-[110px] mx-auto flex-shrink-0">
                  {/* Orange Bubble */}
                  <div className="absolute left-[0px] top-[27px] w-[64px] h-[71px]">
                    <svg width="64" height="71" viewBox="0 0 64 71" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M26.7065 0.447151C19.1045 1.69067 12.2109 5.64725 7.30261 11.5839C2.39432 17.5206 -0.195975 25.0351 0.0115716 32.7353C0.219119 40.4354 3.21044 47.7994 8.43141 53.4631C13.6524 59.1268 20.7491 62.7063 28.407 63.5385C28.0812 65.9027 27.5674 68.2371 26.8706 70.5196C26.8706 70.5196 31.7782 67.7153 34.5081 63.6056C35.3434 63.5385 36.1862 63.4415 37.029 63.2998C41.1726 62.6405 45.145 61.169 48.7181 58.9697C52.2912 56.7705 55.3945 53.8869 57.8498 50.4847C60.305 47.0824 62.0638 43.2285 63.0251 39.1444C63.9864 35.0604 64.1312 30.8266 63.4512 26.6864C62.7713 22.5462 61.2799 18.5811 59.0629 15.0191C56.8459 11.457 53.9468 8.36808 50.5324 5.92983C47.1179 3.49157 43.2553 1.75203 39.1665 0.811136C35.0777 -0.129758 30.8432 -0.253457 26.7065 0.447151Z" fill="#FF7A00"/>
                    <path d="M35.4851 61.002C29.6189 61.9663 23.5985 61.1694 18.1852 58.712C12.7719 56.2547 8.20885 52.2472 5.07314 47.1965C1.93744 42.1458 0.369898 36.2786 0.568751 30.337C0.767603 24.3954 2.72392 18.6461 6.19029 13.8164C9.65667 8.98659 14.4774 5.2932 20.0429 3.20326C25.6084 1.11333 31.6686 0.72071 37.4573 2.07507C43.2459 3.42942 48.5029 6.46992 52.5635 10.8121C56.6241 15.1542 59.3059 20.6029 60.2697 26.4692C61.5498 34.3335 59.6598 42.3845 55.014 48.8576C50.3681 55.3308 43.3454 59.698 35.4851 61.002ZM25.7891 2.07998C19.9974 3.03242 14.6182 5.68088 10.3316 9.69044C6.04512 13.7 3.0438 18.8906 1.7072 24.6059C0.370604 30.3212 0.75876 36.3044 2.82259 41.7991C4.88642 47.2938 8.53323 52.0531 13.3019 55.4752C18.0705 58.8974 23.7468 60.8286 29.613 61.0247C35.4793 61.2209 41.2719 59.6731 46.2585 56.5772C51.2451 53.4812 55.2017 48.9762 57.6279 43.6316C60.0542 38.2871 60.8411 32.3431 59.8893 26.5513C58.6087 18.786 54.2999 11.846 47.9083 7.25396C41.5167 2.66196 33.5644 0.793149 25.7965 2.05761L25.7891 2.07998Z" fill="white"/>
                    <path d="M28.2131 45.6827C24.7996 46.2433 21.2965 45.7791 18.1469 44.3487C14.9972 42.9184 12.3424 40.5861 10.5182 37.647C8.69406 34.7078 7.7824 31.2938 7.89855 27.8365C8.01471 24.3792 9.15345 21.034 11.1708 18.2239C13.1881 15.4138 15.9935 13.2651 19.232 12.0493C22.4706 10.8336 25.9969 10.6055 29.3651 11.3939C32.7333 12.1823 35.792 13.9518 38.1546 16.4786C40.5171 19.0054 42.0773 22.1761 42.6378 25.5896C43.3854 30.1664 42.2863 34.8528 39.5819 38.62C36.8774 42.3872 32.7886 44.9273 28.2131 45.6827ZM22.6043 11.5378C19.2657 12.0867 16.1647 13.6131 13.6934 15.9241C11.2221 18.2352 9.49153 21.227 8.72041 24.5215C7.9493 27.816 8.17227 31.2651 9.36114 34.4329C10.55 37.6006 12.6514 40.3448 15.3997 42.3184C18.1479 44.292 21.4197 45.4065 24.8012 45.5209C28.1828 45.6353 31.5224 44.7446 34.3978 42.9613C37.2732 41.178 39.5553 38.5822 40.9556 35.502C42.3559 32.4219 42.8115 28.9957 42.2649 25.6567C41.5204 21.182 39.0339 17.1844 35.3494 14.5385C31.6649 11.8925 27.0823 10.8136 22.6043 11.5378Z" fill="white"/>
                    </svg>
                  </div>
                  {/* Blue Bubble */}
                  <div className="absolute left-[104px] top-[0px] w-[64px] h-[73px]">
                    <svg width="64" height="73" viewBox="0 0 64 73" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M63.0616 20.4286C62.0968 18.1468 60.8837 15.9782 59.4442 13.9621L60.1005 13.4922C61.5848 15.5552 62.8355 17.7765 63.8298 20.1153L63.0616 20.4286Z" fill="#007BFF"/>
                    <path d="M54.9691 8.85322C50.7891 4.93996 45.6851 2.15057 40.1342 0.745849L40.3355 0C46.0159 1.44367 51.2393 4.29913 55.521 8.3013L54.9691 8.85322Z" fill="#007BFF"/>
                    <path d="M63.7104 33.5934C63.7131 27.3903 61.9047 21.3214 58.5071 16.1315C55.1096 10.9416 50.2707 6.85663 44.5843 4.37792C38.898 1.89921 32.6117 1.13462 26.497 2.17801C20.3823 3.2214 14.7053 6.02736 10.1627 10.2515C5.62012 14.4756 2.40967 19.9341 0.925386 25.957C-0.558894 31.9799 -0.252418 38.3051 1.8072 44.1563C3.86682 50.0074 7.58995 55.13 12.5196 58.8951C17.4493 62.6603 23.371 64.9043 29.558 65.3516C32.0715 69.506 36.6585 72.4894 36.6585 72.4894C36.0761 70.1039 35.6944 67.6739 35.5173 65.2248C43.2784 64.3283 50.4392 60.6102 55.6375 54.7779C60.8358 48.9457 63.709 41.406 63.7104 33.5934Z" fill="#007BFF"/>
                    <path d="M35.9201 31.1687C35.9216 31.9733 35.6842 32.7603 35.2381 33.4299C34.792 34.0995 34.1573 34.6216 33.4142 34.9302C32.6711 35.2388 31.8532 35.3199 31.064 35.1633C30.2748 35.0067 29.5498 34.6194 28.9809 34.0505C28.412 33.4816 28.0247 32.7566 27.8681 31.9674C27.7115 31.1782 27.7926 30.3603 28.1012 29.6172C28.4098 28.8741 28.9319 28.2394 29.6015 27.7933C30.2712 27.3472 31.0581 27.1099 31.8627 27.1113C32.9388 27.1113 33.9708 27.5388 34.7317 28.2997C35.4926 29.0606 35.9201 30.0927 35.9201 31.1687Z" fill="white"/>
                    <path d="M49.9869 36.017C49.9869 36.821 49.7485 37.6069 49.3018 38.2754C48.8552 38.9438 48.2203 39.4648 47.4776 39.7725C46.7348 40.0801 45.9175 40.1606 45.129 40.0038C44.3405 39.8469 43.6162 39.4598 43.0477 38.8913C42.4792 38.3228 42.0921 37.5986 41.9352 36.81C41.7784 36.0215 41.8589 35.2042 42.1666 34.4615C42.4742 33.7187 42.9952 33.0839 43.6637 32.6372C44.3322 32.1905 45.118 31.9521 45.922 31.9521C47.0001 31.9521 48.034 32.3804 48.7963 33.1427C49.5586 33.905 49.9869 34.939 49.9869 36.017Z" fill="white"/>
                    <path d="M21.8758 33.5927C21.8743 34.3949 21.6351 35.1786 21.1884 35.8449C20.7416 36.5111 20.1075 37.03 19.3659 37.3359C18.6244 37.6419 17.8088 37.7212 17.0223 37.5638C16.2357 37.4064 15.5134 37.0194 14.9467 36.4516C14.38 35.8839 13.9943 35.1609 13.8384 34.3741C13.6824 33.5872 13.7632 32.7718 14.0705 32.0308C14.3779 31.2899 14.8979 30.6566 15.565 30.2111C16.2321 29.7656 17.0162 29.5278 17.8184 29.5278C18.3518 29.5278 18.8801 29.633 19.3728 29.8374C19.8656 30.0418 20.3132 30.3413 20.69 30.7189C21.0669 31.0964 21.3656 31.5446 21.5691 32.0377C21.7725 32.5308 21.8768 33.0593 21.8758 33.5927Z" fill="white"/>
                    </svg>
                  </div>
                  {/* Pink Bubble */}
                  <div className="absolute left-[202px] top-[49px] w-[55px] h-[62px]">
                    <svg width="55" height="62" viewBox="0 0 55 62" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M0.0848425 29.3322C-0.326895 24.1323 0.765953 18.9238 3.23301 14.328C5.70006 9.73219 9.43716 5.94312 13.9985 3.41284C18.5598 0.882555 23.7527 -0.282104 28.9577 0.0577915C34.1628 0.397687 39.1601 2.22779 43.3536 5.32978C47.5471 8.43176 50.7597 12.6747 52.6082 17.5523C54.4566 22.4299 54.8628 27.7363 53.7783 32.8384C52.6939 37.9406 50.1645 42.623 46.492 46.3271C42.8195 50.0313 38.1589 52.6007 33.0663 53.7289C31.5685 56.5612 29.5725 59.1004 27.1741 61.2247C27.4249 58.949 27.4997 56.6574 27.3978 54.3703C20.5225 54.4256 13.8816 51.873 8.81338 47.2269C3.74512 42.5808 0.626139 36.1864 0.0848425 29.3322Z" fill="#FF4D8D"/>
                    <path d="M18.2089 29.5488L36.3704 28.1168C36.8005 28.0751 37.1973 27.8669 37.476 27.5366C37.7547 27.2063 37.8933 26.7802 37.8621 26.3491C37.8204 25.9176 37.6111 25.5196 37.2792 25.2407C36.9473 24.9618 36.5192 24.8242 36.0869 24.8574L17.9852 26.2671C17.5529 26.3069 17.1538 26.5156 16.8745 26.848C16.5952 27.1804 16.4583 27.6095 16.4935 28.0422C16.5279 28.4669 16.7261 28.8616 17.0462 29.1428C17.3664 29.424 17.7834 29.5696 18.2089 29.5488Z" fill="white"/>
                    <path d="M18.7311 35.9625L36.8925 34.523C37.3234 34.4831 37.7213 34.2754 38.0004 33.9447C38.2795 33.614 38.4173 33.1868 38.3842 32.7553C38.3407 32.3246 38.1309 31.9277 37.7994 31.6492C37.4679 31.3706 37.0409 31.2323 36.609 31.2636L18.4476 32.6957C18.0168 32.7392 17.62 32.949 17.3415 33.2804C17.0629 33.6119 16.9246 34.039 16.9559 34.4708C16.9995 34.9016 17.2092 35.2984 17.5407 35.5769C17.8722 35.8555 18.2992 35.9938 18.7311 35.9625Z" fill="white"/>
                    <path d="M17.7019 23.1413L35.8857 21.7092C36.3164 21.6657 36.7133 21.4559 36.9918 21.1245C37.2704 20.793 37.4087 20.366 37.3774 19.9341C37.3394 19.5025 37.1322 19.1033 36.801 18.8239C36.4699 18.5444 36.0416 18.4073 35.6097 18.4424L17.4483 19.8745C17.0174 19.9143 16.6194 20.122 16.3403 20.4527C16.0612 20.7834 15.9234 21.2106 15.9566 21.6421C15.9946 22.0702 16.1984 22.4665 16.5244 22.7466C16.8504 23.0266 17.2729 23.1682 17.7019 23.1413Z" fill="white"/>
                    </svg>
                  </div>
                </div>

                {/* Text and supporting text */}
                <div className="flex flex-col items-center gap-[8px] w-full max-w-[320px]">
                  <h3 className="font-poppins font-medium text-[18px] leading-[20px] text-[#1B1818] dark:text-[#f5f5f5] text-center">
                    Faites le premier pas
                  </h3>
                  <p className="font-['Inter_Display'] font-normal text-[12px] leading-[16px] text-center text-[#404040] dark:text-[#a3a3a3]">
                    Faites connaissance, partagez vos idées ou préparez votre prochaine sortie. Il ne manque plus qu'un premier message.
                  </p>
                </div>

                {/* Button */}
                <button
                  onClick={() => setShowNewConv(true)}
                  className="mt-[16px] flex flex-row items-center justify-center gap-[4px] px-[12px] py-[8px] w-[242px] h-[36px] bg-[#FF991C] rounded-[9999px] active:scale-95 transition-transform"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M1.66667 8.75016C1.66667 8.10784 1.67789 7.48082 1.69925 6.87541C1.76902 4.89752 1.80391 3.90857 2.6084 3.09804C3.41288 2.2875 4.42975 2.244 6.4635 2.15699C7.57931 2.10925 8.76742 2.0835 10 2.0835C11.2326 2.0835 12.4207 2.10925 13.5365 2.15699C15.5703 2.244 16.5872 2.2875 17.3916 3.09804C18.1961 3.90857 18.231 4.89752 18.3008 6.87541C18.3221 7.48082 18.3333 8.10784 18.3333 8.75016C18.3333 9.3925 18.3221 10.0195 18.3008 10.6249C18.231 12.6028 18.1961 13.5917 17.3916 14.4023C16.5872 15.2128 15.5703 15.2563 13.5364 15.3433C12.9248 15.3695 12.2915 15.3891 11.6411 15.4014C11.0235 15.4131 10.7147 15.419 10.4433 15.5223C10.172 15.6257 9.94375 15.8214 9.48709 16.2129L7.67086 17.7703C7.56061 17.8648 7.42016 17.9168 7.27493 17.9168C6.939 17.9168 6.66667 17.6445 6.66667 17.3086V15.3517C6.59869 15.349 6.53096 15.3462 6.4635 15.3433C4.42975 15.2563 3.41288 15.2128 2.6084 14.4022C1.80391 13.5917 1.76902 12.6028 1.69925 10.6249C1.67789 10.0195 1.66667 9.3925 1.66667 8.75016Z" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M12.9167 8.75016H7.08333M10 5.8335V11.6668" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#FFFFFF]">
                    Démarrer une conversation
                  </span>
                </button>
              </div>
            )}
          </>
        )}
          </div>
        </PullToRefresh>
      </div>

      {/* FAB for filled state */}
      {visibleConversations.length > 0 && (
        <button 
          onClick={() => setShowNewConv(true)}
          className="absolute bottom-[90px] right-[16px] w-[40px] h-[40px] bg-[#FF991C] rounded-[8px] flex items-center justify-center shadow-sm active:scale-95 transition-transform z-30"
        >
          <div className="relative flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1.66667 8.75016C1.66667 8.10784 1.67789 7.48082 1.69925 6.87541C1.76902 4.89752 1.80391 3.90857 2.6084 3.09804C3.41288 2.2875 4.42975 2.244 6.4635 2.15699C7.57931 2.10925 8.76742 2.0835 10 2.0835C11.2326 2.0835 12.4207 2.10925 13.5365 2.15699C15.5703 2.244 16.5872 2.2875 17.3916 3.09804C18.1961 3.90857 18.231 4.89752 18.3008 6.87541C18.3221 7.48082 18.3333 8.10784 18.3333 8.75016C18.3333 9.3925 18.3221 10.0195 18.3008 10.6249C18.231 12.6028 18.1961 13.5917 17.3916 14.4023C16.5872 15.2128 15.5703 15.2563 13.5364 15.3433C12.9248 15.3695 12.2915 15.3891 11.6411 15.4014C11.0235 15.4131 10.7147 15.419 10.4433 15.5223C10.172 15.6257 9.94375 15.8214 9.48709 16.2129L7.67086 17.7703C7.56061 17.8648 7.42016 17.9168 7.27493 17.9168C6.939 17.9168 6.66667 17.6445 6.66667 17.3086V15.3517C6.59869 15.349 6.53096 15.3462 6.4635 15.3433C4.42975 15.2563 3.41288 15.2128 2.6084 14.4022C1.80391 13.5917 1.76902 12.6028 1.69925 10.6249C1.67789 10.0195 1.66667 9.3925 1.66667 8.75016Z" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12.9167 8.75016H7.08333M10 5.8335V11.6668" stroke="white" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </button>
      )}

      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} />}
      {showAddFriends && <AddFriendsModal onClose={() => setShowAddFriends(false)} />}

      {/* Context Menu for Pinning */}
      {contextMenu && (
        <div 
          className="fixed z-50 bg-white dark:bg-[#1A1A1A] rounded-xl shadow-xl border border-gray-100 dark:border-white/10 py-1.5 w-60 overflow-hidden animate-in fade-in zoom-in duration-200"
          style={{ top: Math.min(contextMenu.y, window.innerHeight - 250), left: Math.min(contextMenu.x, window.innerWidth - 240) }}
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:bg-[#222222] active:bg-gray-100 dark:bg-[#2A2A2A] dark:bg-[#2a2a2a] transition-colors"
            onClick={() => togglePin(contextMenu.convId)}
          >
            {pinnedConvs.includes(contextMenu.convId) ? (
              <><PinOff className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" /><span className="text-[14px] font-medium text-gray-700">Désépingler</span></>
            ) : (
              <><Pin className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" /><span className="text-[14px] font-medium text-gray-700">Épingler</span></>
            )}
          </button>
          
          <button 
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:bg-[#222222] active:bg-gray-100 dark:bg-[#2A2A2A] dark:bg-[#2a2a2a] transition-colors"
            onClick={() => toggleMute(contextMenu.convId)}
          >
            {mutedConvs.includes(contextMenu.convId) ? (
              <><Bell className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" /><span className="text-[14px] font-medium text-gray-700">Réactiver le son</span></>
            ) : (
              <><BellOff className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" /><span className="text-[14px] font-medium text-gray-700">Mettre en sourdine</span></>
            )}
          </button>

          <button 
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-gray-50 dark:bg-[#222222] active:bg-gray-100 dark:bg-[#2A2A2A] dark:bg-[#2a2a2a] transition-colors"
            onClick={() => toggleReadStatus(contextMenu.convId, contextMenu.unread)}
          >
            {(forceUnreadConvs.includes(contextMenu.convId) || (contextMenu.unread > 0 && !forceReadConvs.includes(contextMenu.convId))) ? (
              <><CheckCircle2 className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" /><span className="text-[14px] font-medium text-gray-700">Marquer comme lu</span></>
            ) : (
              <><Circle className="w-[18px] h-[18px] text-gray-500 dark:text-gray-400" /><span className="text-[14px] font-medium text-gray-700">Marquer comme non lu</span></>
            )}
          </button>

          <div className="h-[1px] bg-gray-100 dark:bg-[#2A2A2A] dark:bg-[#2a2a2a] w-full my-1" />

          <button 
            className="w-full px-4 py-3 text-left flex items-center gap-3 hover:bg-red-50 active:bg-red-100 transition-colors"
            onClick={() => hideConversation(contextMenu.convId)}
          >
            <Trash2 className="w-[18px] h-[18px] text-red-500" />
            <span className="text-[14px] font-medium text-red-500">Supprimer</span>
          </button>
        </div>
      )}
    </div>
  );
}

const ConvItem = memo(function ConvItem({ conv, onNavigate, onContextMenu }: { conv: any; onNavigate: () => void; onContextMenu?: (e: React.MouseEvent) => void }) {
  const hasUnread = conv.unread > 0;
  return (
    <button
      onClick={onNavigate}
      onContextMenu={onContextMenu}
      className="w-full flex flex-row items-center gap-[8px] h-[48px] text-left transition-colors hover:bg-gray-50/50 active:bg-gray-50 dark:hover:bg-white/5 dark:active:bg-white/10 relative px-[8px] -mx-[8px] rounded-[12px]"
    >
      {/* Cover */}
      <div className="relative flex-shrink-0 w-[48px] h-[48px] flex justify-center items-center">
        <div className="w-[48px] h-[48px] rounded-[24px] overflow-hidden bg-[#F5F5F5] flex-shrink-0">
          <SafeImage
            src={conv.avatarUrl}
            alt={conv.name}
            className="w-full h-full object-cover"
            fallback={
              conv.isGroup ? (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
                  <path d="M27 20C27 21.6568 25.6569 23 24 23C22.3431 23 21 21.6568 21 20C21 18.3432 22.3431 17 24 17C25.6569 17 27 18.3432 27 20Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M28 16C29.6569 16 31 17.3432 31 19C31 20.2231 30.2681 21.2752 29.2183 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M25.7143 26H22.2857C19.9188 26 18 27.9188 18 30.2857C18 31.2325 18.7675 32 19.7143 32H28.2857C29.2325 32 30 31.2325 30 30.2857C30 27.9188 28.0812 26 25.7143 26Z" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M29.7143 25C32.0812 25 34 26.9188 34 29.2857C34 30.2325 33.2325 31 32.2857 31" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M20 16C18.3432 16 17 17.3432 17 19C17 20.2231 17.7319 21.2752 18.7817 21.7423" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M15.7143 31C14.7675 31 14 30.2325 14 29.2857C14 26.9188 15.9188 25 18.2857 25" stroke="#A3A3A3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <g clipPath="url(#clip0_1415_2646)">
                    <g clipPath="url(#clip1_1415_2646)">
                      <rect width="48" height="48" rx="24" fill="#F5F5F5"/>
                      <circle cx="24" cy="16" r="8" fill="#BDBDBD"/>
                      <circle cx="24" cy="49" r="22" fill="#BDBDBD"/>
                    </g>
                  </g>
                  <defs>
                    <clipPath id="clip0_1415_2646">
                      <rect width="48" height="48" fill="white"/>
                    </clipPath>
                    <clipPath id="clip1_1415_2646">
                      <rect width="48" height="48" rx="24" fill="white"/>
                    </clipPath>
                  </defs>
                </svg>
              )
            }
          />
        </div>
        {/* Status spot */}
        {!conv.isGroup && (
          <div className="absolute w-[8px] h-[8px] bg-[#22C55E] rounded-full" style={{ left: '32px', top: '38px' }} />
        )}
      </div>

      {/* Chat info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[2px] h-[38px] justify-center">
        {/* Top Row */}
        <div className="w-full flex flex-row justify-between items-center h-[20px]">
          <h3 className="font-poppins font-medium text-[14px] leading-[20px] text-[#1B1818] dark:text-[#f5f5f5] truncate">
            {conv.name}
          </h3>
          <span className="font-['Inter_Display'] font-normal text-[10px] leading-[16px] text-[#737373] flex-shrink-0 ml-2">
            {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        
        {/* Bottom Row */}
        <div className="w-full flex flex-row items-center gap-[8px] h-[16px]">
          <p className="flex-1 font-['Inter_Display'] font-normal text-[12px] leading-[16px] text-[#525252] truncate">
            {conv.lastMsgPrefix && <span className="font-medium mr-1">{conv.lastMsgPrefix}</span>}
            {conv.lastMsg}
          </p>
          {/* Status badge */}
          {hasUnread && (
            <div className="flex-shrink-0 min-w-[16px] h-[16px] px-[4px] bg-[#FF7A00] rounded-[12px] flex items-center justify-center">
              <span className="font-['Inter_Display'] font-semibold text-[12px] leading-[16px] text-[#FFFFFF]">
                {conv.unread > 9 ? '9+' : conv.unread}
              </span>
            </div>
          )}
          {conv.isPinned && !hasUnread && (
            <Pin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-1" />
          )}
          {conv.isMuted && (
            <BellOff className="w-3 h-3 text-gray-400 flex-shrink-0 ml-1" />
          )}
        </div>
      </div>
    </button>
  );
});


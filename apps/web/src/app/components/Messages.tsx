import { useState, useMemo, memo } from 'react';
import { Search, Plus, X, Trash2, MessageCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { useConversations } from '@/features/chat/api';
import { useChatSocket } from '@/features/chat/hooks/useChatSocket';
import { NewConversationModal } from '@/features/chat/components/NewConversationModal';
import { AddFriendsModal } from '@/features/users/components/AddFriendsModal';
import { SafeImage } from '@/components/shared/SafeImage';
import { useAuthStore } from '@/stores/auth.store';

interface MessagesProps {}



export function Messages(_props: MessagesProps) {
  const navigate = useNavigate();
  useChatSocket();
  const { data: conversations, isLoading } = useConversations();
  const [showNewConv, setShowNewConv] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'friends' | 'groups'>('all');

  const user = useAuthStore((s) => s.user);

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

          return {
            id: conv.id,
            isGroup: conv.isGroup,
            name,
            avatarUrl,
            lastMessageAt: conv.lastMessageAt,
            lastMsg,
            lastMsgPrefix,
            unread: conv.unread || 0,
          };
        })
      : [];
  }, [conversations, user?.id]);

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
    <div className="w-full h-full flex flex-col bg-[#FFFFFF] font-poppins">

      {/* Header Section */}
      <div className="flex flex-col items-start px-[16px] pt-[10px] pb-[10px] gap-[12px] w-full bg-[#FFFFFF] sticky top-0 z-20">
        <h1 className="text-[28px] font-bold text-[#1B1818] mb-1">Messages</h1>

        {visibleConversations.length > 0 || searchQuery ? (
          <>
            {/* Search */}
            <div className="w-full h-[36px] bg-[#FFFFFF] opacity-80 border border-[#D4D4D4] rounded-[1000px] flex items-center gap-[8px] px-[12px] py-[8px] box-border">
              <Search className="w-[20px] h-[20px] text-[#A3A3A3] flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Rechercher une conversation..."
                className="flex-1 bg-transparent outline-none text-[14px] text-[#1B1818] placeholder:text-[#BDBDBD] font-['Inter_Display'] min-w-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-100 rounded-full transition-colors flex-shrink-0">
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
                        ? 'bg-[#FFF2D3] text-[#FF7A00]'
                        : 'bg-[#FAFAFA] text-[#56514F]'
                    }`}
                  >
                    <span className="font-poppins font-medium text-[12px] leading-[16px]">
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        ) : null}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto flex flex-col items-center py-[16px]" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="w-full flex flex-col gap-[16px] px-[16px]">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-full h-[48px] bg-white rounded-2xl flex items-center gap-[8px] animate-pulse">
                <div className="w-[48px] h-[48px] rounded-[24px] bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
                  <div className="h-3 bg-gray-100 rounded-lg w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {visibleConversations.length > 0 ? (
              <div className="w-full flex flex-col gap-[16px] px-[16px]">
                {visibleConversations.map(conv => (
                  <ConvItem key={conv.id} conv={conv} onNavigate={() => navigate(`/chat/${conv.id}`)} />
                ))}
              </div>
            ) : (
              /* Empty state */
              <div className="flex flex-col items-center gap-[20px] px-[16px] w-full max-w-[358px]">
                {/* Chat Empty Illustration */}
                <div className="relative w-[256px] h-[110px] mx-auto flex-shrink-0">
                  {/* Orange Bubble */}
                  <div className="absolute left-[0px] top-[27px] w-[64px] h-[70px]">
                    <svg viewBox="0 0 64 70" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <path d="M32 60C49.673 60 64 46.568 64 30C64 13.431 49.673 0 32 0C14.327 0 0 13.431 0 30C0 37.1 2.3 43.6 6 48.8L2 68L18.5 60.5C22.6 62.4 27.1 63.5 32 63.5V60Z" fill="#FF7A00"/>
                      <circle cx="32" cy="30" r="15" stroke="white" strokeWidth="1.5" />
                    </svg>
                  </div>
                  {/* Blue Bubble */}
                  <div className="absolute left-[104px] top-[0px] w-[64px] h-[72px]">
                    <svg viewBox="0 0 64 72" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <path d="M32 64C49.673 64 64 49.673 64 32C64 14.327 49.673 0 32 0C14.327 0 0 14.327 0 32C0 39.5 2.6 46.4 7 51.8L2 72L19.5 64.5C23.3 66.4 27.5 67.5 32 67.5V64Z" fill="#007BFF"/>
                      <circle cx="20" cy="32" r="3" fill="white"/>
                      <circle cx="32" cy="32" r="3" fill="white"/>
                      <circle cx="44" cy="32" r="3" fill="white"/>
                    </svg>
                  </div>
                  {/* Pink Bubble */}
                  <div className="absolute left-[202px] top-[49px] w-[54px] h-[61px]">
                    <svg viewBox="0 0 54 61" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                      <path d="M27 54C41.911 54 54 41.911 54 27C54 12.088 41.911 0 27 0C12.088 0 0 12.088 0 27C0 33.3 2.2 39.2 6 43.7L2 61L16.5 54.5C19.7 56.1 23.2 57 27 57V54Z" fill="#FF4D8D"/>
                      <line x1="15" y1="21" x2="39" y2="21" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      <line x1="15" y1="28" x2="39" y2="28" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                      <line x1="15" y1="35" x2="28" y2="35" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                    </svg>
                  </div>
                </div>

                {/* Text and supporting text */}
                <div className="flex flex-col items-center gap-[8px] w-full max-w-[320px]">
                  <h3 className="font-poppins font-medium text-[18px] leading-[20px] text-[#1B1818] text-center">
                    Faites le premier pas
                  </h3>
                  <p className="font-['Inter_Display'] font-normal text-[12px] leading-[16px] text-center text-[#404040]">
                    Faites connaissance, partagez vos idées ou préparez votre prochaine sortie. Il ne manque plus qu'un premier message.
                  </p>
                </div>

                {/* Button */}
                <button
                  onClick={() => setShowNewConv(true)}
                  className="mt-[16px] flex flex-row items-center justify-center gap-[4px] px-[12px] py-[8px] w-[242px] h-[36px] bg-[#FF991C] rounded-[9999px] active:scale-95 transition-transform"
                >
                  <MessageCircle className="w-[18px] h-[18px] text-white" />
                  <span className="font-poppins font-medium text-[14px] leading-[20px] text-[#FFFFFF]">
                    Démarrer une conversation
                  </span>
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB for filled state */}
      {visibleConversations.length > 0 && (
        <button 
          onClick={() => setShowNewConv(true)}
          className="absolute bottom-[90px] right-[16px] w-[40px] h-[40px] bg-[#FF991C] rounded-[8px] flex items-center justify-center shadow-sm active:scale-95 transition-transform z-30"
        >
          <div className="relative flex items-center justify-center">
            <MessageCircle className="w-[20px] h-[20px] text-white" strokeWidth={2} />
            <div className="absolute top-[3px] right-[2px] w-[6px] h-[6px] bg-[#FF991C] rounded-full flex items-center justify-center">
              <Plus className="w-[6px] h-[6px] text-white" strokeWidth={4} />
            </div>
          </div>
        </button>
      )}

      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} />}
      {showAddFriends && <AddFriendsModal onClose={() => setShowAddFriends(false)} />}
    </div>
  );
}

const ConvItem = memo(function ConvItem({ conv, onNavigate }: { conv: any; onNavigate: () => void }) {
  const hasUnread = conv.unread > 0;
  return (
    <button
      onClick={onNavigate}
      className="w-full flex flex-row items-center gap-[8px] h-[48px] text-left transition-colors active:bg-gray-50"
    >
      {/* Cover */}
      <div className="relative flex-shrink-0 w-[48px] h-[48px] flex justify-center items-center">
        <div className="w-[48px] h-[48px] rounded-[24px] overflow-hidden bg-[#F5F5F5]">
          <SafeImage
            src={conv.avatarUrl}
            alt={conv.name}
            className="w-full h-full object-cover"
            fallback={<div className="w-full h-full flex items-center justify-center text-lg font-semibold text-[#BDBDBD]">{conv.isGroup ? '👥' : conv.name.charAt(0).toUpperCase()}</div>}
          />
        </div>
        {/* Status spot */}
        {!conv.isGroup && (
          <div className="absolute w-[8px] h-[8px] bg-[#22C55E] rounded-full border border-white" style={{ left: '32px', top: '38px' }} />
        )}
      </div>

      {/* Chat info */}
      <div className="flex-1 min-w-0 flex flex-col gap-[2px] h-[38px] justify-center">
        {/* Top Row */}
        <div className="w-full flex flex-row justify-between items-center h-[20px]">
          <h3 className="font-poppins font-medium text-[14px] leading-[20px] text-[#1B1818] truncate">
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
        </div>
      </div>
    </button>
  );
});


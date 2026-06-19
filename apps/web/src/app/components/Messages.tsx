import { useState, useMemo, memo } from 'react';
import { Search, Plus, X, Trash2 } from 'lucide-react';
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
  const [activeFilter, setActiveFilter] = useState<'discussions' | 'groups'>('discussions');

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
    return directs; // 'discussions' -> messages directs
  }, [activeFilter, groups, directs]);

  return (
    <div className="w-full h-full flex flex-col bg-[#FFFFFF]" style={{ fontFamily: "'Poppins', sans-serif" }}>

      {/* Header */}
      <div className="px-5 pt-4 pt-safe-4 pb-2 bg-[#FFFFFF] sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[28px] font-semibold text-[#1B1818]">Messages</h1>
          <button className="p-2 active:scale-95 transition-transform">
            <Trash2 className="w-[22px] h-[22px] text-gray-400" />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center gap-6 mb-4 border-b border-gray-100">
          {[
            { key: 'discussions' as const, label: 'Discussions' },
            { key: 'groups' as const, label: 'Groupes' },
          ].map(tab => {
            const isActive = activeFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveFilter(tab.key)}
                className={`pb-2 text-[16px] transition-colors relative ${
                  isActive
                    ? 'font-semibold text-[#FF7A00]'
                    : 'font-medium text-[#8D8D8D]'
                }`}
              >
                {tab.label}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#FF7A00]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="bg-[#F6F6F6] border border-gray-200/50 rounded-full flex items-center gap-3 px-4 py-3 mb-2">
          <Search className="w-[18px] h-[18px] text-[#8D8D8D] flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher des discussions"
            className="flex-1 bg-transparent outline-none text-[14px] text-[#1B1818] placeholder:text-[#8D8D8D] font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-3.5 h-3.5 text-[#8D8D8D]" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
        {isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 flex items-center gap-3 animate-pulse">
                <div className="w-14 h-14 rounded-2xl bg-gray-200 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded-lg w-2/3" />
                  <div className="h-3 bg-gray-100 rounded-lg w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Filtered Conversations */}
            {visibleConversations.length > 0 && (
              <div className="pt-3">
                <div className="space-y-1 px-4">
                  {visibleConversations.map(conv => (
                    <ConvItem key={conv.id} conv={conv} onNavigate={() => navigate(`/chat/${conv.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty/No search results */}
            {visibleConversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-24 h-24 rounded-full mb-5 flex items-center justify-center bg-gray-50 shadow-sm border border-gray-100">
                  <MessageCircle className="w-10 h-10 text-gray-300" />
                </div>
                <h3 className="text-[17px] font-bold text-gray-900 mb-2">
                  Aucune conversation
                </h3>
                <p className="text-[14px] text-gray-500 max-w-[250px]">
                  Démarrez une discussion pour commencer.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {/* FAB (Floating Action Button) */}
      <button 
        onClick={() => setShowNewConv(true)}
        className="absolute bottom-[90px] right-5 w-14 h-14 bg-[#FF7A00] rounded-[20px] flex items-center justify-center shadow-lg shadow-orange-500/30 active:scale-95 transition-transform z-30"
      >
        <div className="relative">
          <MessageCircle className="w-[26px] h-[26px] text-white" strokeWidth={2.5} />
          <div className="absolute top-[8px] right-[8px] w-[10px] h-[10px] bg-white rounded-full flex items-center justify-center">
            <Plus className="w-[8px] h-[8px] text-[#FF7A00]" strokeWidth={4} />
          </div>
        </div>
      </button>

      {showNewConv && <NewConversationModal onClose={() => setShowNewConv(false)} />}
      {showAddFriends && <AddFriendsModal onClose={() => setShowAddFriends(false)} />}
    </div>
  );
}

// ── Memoized conversation item — prevents re-renders while typing in search ──
const ConvItem = memo(function ConvItem({ conv, onNavigate }: { conv: any; onNavigate: () => void }) {
  const hasUnread = conv.unread > 0;
  return (
    <button
      onClick={onNavigate}
      className="w-full flex flex-row items-center gap-4 px-5 py-3 text-left transition-colors active:bg-gray-50 bg-[#FFFFFF] mb-1"
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-[52px] h-[52px] rounded-full overflow-hidden bg-gray-100">
          <SafeImage
            src={conv.avatarUrl}
            alt={conv.name}
            className="w-full h-full object-cover"
            fallback={<div className="w-full h-full flex items-center justify-center text-xl font-semibold text-gray-500 bg-gray-200">{conv.isGroup ? '👥' : conv.name.charAt(0).toUpperCase()}</div>}
          />
        </div>
      </div>

      {/* Content Block */}
      <div className="flex-1 min-w-0 py-1 flex flex-col justify-center">
        <h3 className={`text-[16px] truncate text-[#1B1818] font-[600]`}>
          {conv.name}
        </h3>
        <div className="flex items-center gap-1.5 min-w-0 mt-0.5">
          <p className="text-[14px] truncate text-[#8D8D8D]">
            {conv.lastMsgPrefix && <span className="font-medium mr-1">{conv.lastMsgPrefix}</span>}
            {conv.lastMsg}
          </p>
        </div>
      </div>

      {/* Info Block (Right) */}
      <div className="flex flex-col items-end justify-between flex-shrink-0 h-[44px]">
        <span className={`text-[12px] whitespace-nowrap text-[#8D8D8D]`}>
          {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>
        {hasUnread && (
          <div className="flex-shrink-0 min-w-[20px] h-[20px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-semibold text-white bg-[#FF7A00]">
            {conv.unread > 9 ? '9+' : conv.unread}
          </div>
        )}
      </div>
    </button>
  );
});


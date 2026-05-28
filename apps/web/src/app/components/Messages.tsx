import { useState, useMemo, memo } from 'react';
import { Search, Users, MessageCircle, CheckCheck, Plus, UserPlus, X } from 'lucide-react';
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
  const totalUnread = displayConversations.reduce((acc, c) => acc + (c.unread || 0), 0);

  return (
    <div className="w-full h-full flex flex-col bg-background">

      {/* Header */}
      <div className="bg-card/95 backdrop-blur-md px-5 pt-4 pt-safe-4 pb-4 border-b border-border sticky top-0 z-20">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-[24px] font-black tracking-tight text-foreground">Messages</h1>
            {totalUnread > 0 && (
              <p className="text-[13px] font-bold text-action-primary mt-0.5 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-action-primary animate-pulse" />
                {totalUnread} message{totalUnread > 1 ? 's' : ''} non lu{totalUnread > 1 ? 's' : ''}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddFriends(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-all hover:bg-gray-100 active:scale-95 bg-gray-50"
            >
              <UserPlus className="w-5 h-5 text-gray-700" />
            </button>
            <button
              onClick={() => setShowNewConv(true)}
              className="w-10 h-10 rounded-full flex items-center justify-center transition-transform active:scale-95 bg-orange-50 shadow-sm"
            >
              <Plus className="w-6 h-6 text-action-primary" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-muted/80 backdrop-blur-sm rounded-full flex items-center gap-3 px-4 py-3 border border-border focus-within:ring-2 focus-within:ring-[#FF7A00]/30 focus-within:border-action-primary/30 focus-within:bg-card transition-all shadow-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher une conversation..."
            className="flex-1 bg-transparent outline-none text-[14px] text-foreground placeholder:text-muted-foreground font-medium"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="p-1 hover:bg-gray-200 rounded-full transition-colors">
              <X className="w-3.5 h-3.5 text-gray-500" />
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto pb-6" style={{ scrollbarWidth: 'none' }}>
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
            {/* Groups */}
            {groups.length > 0 && (
              <div className="pt-4">
                <div className="px-5 mb-2 flex items-center gap-2">
                  <Users className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Groupes</span>
                </div>
                <div className="space-y-1 px-4">
                  {groups.map(conv => (
                    <ConvItem key={conv.id} conv={conv} onNavigate={() => navigate(`/chat/${conv.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {/* Direct Messages */}
            {directs.length > 0 && (
              <div className="pt-4">
                <div className="px-5 mb-2 flex items-center gap-2">
                  <MessageCircle className="w-4 h-4 text-gray-400" />
                  <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Messages directs</span>
                </div>
                <div className="space-y-1 px-4">
                  {directs.map(conv => (
                    <ConvItem key={conv.id} conv={conv} onNavigate={() => navigate(`/chat/${conv.id}`)} />
                  ))}
                </div>
              </div>
            )}

            {/* Empty/No search results */}
            {filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
                <div className="w-24 h-24 rounded-full mb-5 flex items-center justify-center bg-gradient-to-br from-orange-50 to-orange-100 shadow-sm border border-white">
                  {searchQuery ? <Search className="w-10 h-10 text-action-primary" /> : <MessageCircle className="w-10 h-10 text-action-primary" />}
                </div>
                <h3 className="text-[17px] font-bold text-gray-900 mb-2">
                  {searchQuery ? 'Aucun résultat' : 'Aucune conversation'}
                </h3>
                <p className="text-[14px] text-gray-500 max-w-[250px]">
                  {searchQuery ? `Aucune conversation ne correspond à "${searchQuery}"` : 'Rejoignez un événement ou démarrez une discussion.'}
                </p>
                {!searchQuery && (
                  <button
                    onClick={() => setShowNewConv(true)}
                    className="mt-6 px-6 py-3 bg-action-primary text-white rounded-full font-bold text-[14px] shadow-lg shadow-action-primary/30 active:scale-95 transition-transform"
                  >
                    Démarrer une discussion
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

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
      className={`w-full rounded-[24px] flex items-center gap-3 p-3 text-left transition-all active:scale-[0.98] border border-transparent ${hasUnread ? 'bg-card shadow-[0_4px_20px_rgb(255,159,28,0.1)] border-action-primary/10 z-10 relative' : 'bg-card/80 hover:bg-card shadow-sm border-border/50'}`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-14 h-14 rounded-[20px] overflow-hidden bg-gray-100 shadow-sm ring-2 ring-white">
          <SafeImage
            src={conv.avatarUrl}
            alt={conv.name}
            className="w-full h-full object-cover"
            fallback={<div className="w-full h-full flex items-center justify-center text-2xl font-bold text-white bg-orange-400">{conv.isGroup ? '👥' : conv.name.charAt(0).toUpperCase()}</div>}
          />
        </div>
        {conv.isGroup && (
          <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center border-2 border-white shadow-sm bg-orange-400">
            <Users className="w-2.5 h-2.5 text-white" />
          </div>
        )}
        {!conv.isGroup && (
          <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-emerald-400 rounded-full border-[3px] border-white shadow-sm" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-1">
        <div className="flex items-center justify-between mb-1">
          <h3 className={`text-[15px] truncate pr-2 text-foreground ${hasUnread ? 'font-black' : 'font-bold'}`}>
            {conv.name}
          </h3>
          <span className={`text-[11px] whitespace-nowrap flex-shrink-0 font-bold ${hasUnread ? 'text-action-primary' : 'text-gray-400'}`}>
            {conv.lastMessageAt ? new Date(conv.lastMessageAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : ''}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {!hasUnread && <CheckCheck className="w-4 h-4 text-action-primary flex-shrink-0" />}
            <p className={`text-[13px] truncate ${hasUnread ? 'text-foreground font-bold' : 'text-muted-foreground font-medium'}`}>
              {conv.lastMsgPrefix && <span className="font-bold text-action-primary mr-1">{conv.lastMsgPrefix}</span>}
              {conv.lastMsg}
            </p>
          </div>
          {hasUnread && (
            <span className="flex-shrink-0 min-w-[22px] h-[22px] px-1.5 rounded-full flex items-center justify-center text-[11px] font-black text-white shadow-[0_2px_10px_rgba(255,159,28,0.4)] bg-action-primary">
              {conv.unread > 9 ? '9+' : conv.unread}
            </span>
          )}
        </div>
      </div>
    </button>
  );
});


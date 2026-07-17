import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';
import { useNavigate } from 'react-router';
import { MessageSquare, Clock, ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export function AdminSupportChats() {
  const navigate = useNavigate();

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['admin', 'bot-conversations'],
    queryFn: async () => {
      const { data } = await apiClient.get('/chat/admin/bot-conversations');
      return data as any[];
    },
    refetchInterval: 10000 // Refresh every 10s
  });

  if (isLoading) {
    return <div className="p-8 text-white/50">Chargement des conversations...</div>;
  }

  return (
    <div className="p-6 lg:p-10 h-full overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-2">
          <MessageSquare className="w-6 h-6 text-action-primary" />
          Support & Messages
        </h1>
        <p className="text-white/60">Gérez les conversations d'assistance et reprenez la main sur les bots si nécessaire.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {conversations?.map((conv) => {
          // Find the normal user and the bot
          const userMember = conv.members.find((m: any) => !m.user.isBot);
          const botMember = conv.members.find((m: any) => m.user.isBot);
          const lastMessage = conv.messages?.[0];

          return (
            <div 
              key={conv.id}
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="bg-[#1A1A1A] border border-white/10 rounded-2xl p-5 cursor-pointer hover:border-action-primary/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-[#222]">
                    <img src={userMember?.user?.profile?.avatarUrl || 'https://i.pravatar.cc/150'} alt="User" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">{userMember?.user?.profile?.displayName || 'Utilisateur'}</h3>
                    <p className="text-xs text-white/50">avec {botMember?.user?.profile?.displayName}</p>
                  </div>
                </div>
                {conv.isBotPaused && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-500">
                    <ShieldAlert className="w-3 h-3" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Admin</span>
                  </div>
                )}
              </div>

              <div className="bg-[#111] rounded-xl p-3 mb-3 border border-white/5">
                <p className="text-sm text-white/80 line-clamp-2">
                  <span className="font-semibold text-white/40 mr-1">
                    {lastMessage?.senderId === botMember?.userId ? 'Bot:' : 'User:'}
                  </span>
                  {lastMessage?.content || 'Nouvelle discussion'}
                </p>
              </div>

              <div className="flex items-center justify-between text-xs text-white/40">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{conv.lastMessageAt ? format(new Date(conv.lastMessageAt), 'PPp', { locale: fr }) : 'Inconnu'}</span>
                </div>
                <div className="font-semibold text-action-primary">
                  Ouvrir le chat
                </div>
              </div>
            </div>
          );
        })}

        {(!conversations || conversations.length === 0) && (
          <div className="col-span-full py-12 text-center border-2 border-dashed border-white/10 rounded-2xl">
            <MessageSquare className="w-8 h-8 text-white/20 mx-auto mb-3" />
            <p className="text-white/50">Aucune conversation de support active.</p>
          </div>
        )}
      </div>
    </div>
  );
}

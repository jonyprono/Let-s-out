import { Search, Home as HomeIcon, Compass, MessageCircle, User } from 'lucide-react';

interface MessagesProps {
  onNavigate: (screen: string) => void;
}

const mockConversations = [
  {
    id: 1,
    name: 'Sarah Martin',
    lastMessage: 'Super ! À ce soir alors 😊',
    time: '14:32',
    unread: 2,
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
  },
  {
    id: 2,
    name: 'Groupe Brunch Dimanche',
    lastMessage: 'Thomas: J\'apporte les croissants',
    time: '12:15',
    unread: 5,
    avatar: 'https://images.unsplash.com/photo-1464979681340-bdd28a61699e?w=100&h=100&fit=crop',
    isGroup: true,
  },
  {
    id: 3,
    name: 'Alex Dupont',
    lastMessage: 'Merci pour l\'invitation !',
    time: 'Hier',
    unread: 0,
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop',
  },
  {
    id: 4,
    name: 'Running Club Paris',
    lastMessage: 'Marie: RDV à 8h demain',
    time: 'Hier',
    unread: 0,
    avatar: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=100&h=100&fit=crop',
    isGroup: true,
  },
];

export function Messages({ onNavigate }: MessagesProps) {
  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Status Bar */}
      <div className="h-11 flex items-center justify-between px-6">
        <span className="text-sm">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-black rounded-sm" />
        </div>
      </div>

      {/* Header */}
      <div className="px-6 py-4">
        <h1 className="text-2xl mb-4">Messages</h1>

        {/* Search Bar */}
        <div className="px-4 py-3 bg-gray-100 rounded-full flex items-center gap-3">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Rechercher une conversation..."
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {mockConversations.map((conversation) => (
          <button
            key={conversation.id}
            className="w-full px-6 py-4 flex items-center gap-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
          >
            <div className="relative">
              <img
                src={conversation.avatar}
                alt={conversation.name}
                className="w-14 h-14 rounded-full object-cover"
              />
              {conversation.unread > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-xs text-white">{conversation.unread}</span>
                </div>
              )}
            </div>

            <div className="flex-1 text-left">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm">
                  {conversation.name}
                  {conversation.isGroup && (
                    <span className="ml-2 text-xs text-gray-400">(Groupe)</span>
                  )}
                </h3>
                <span className="text-xs text-gray-400">{conversation.time}</span>
              </div>
              <p className={`text-sm ${conversation.unread > 0 ? 'text-gray-900' : 'text-gray-500'}`}>
                {conversation.lastMessage}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <button
            onClick={() => onNavigate('home')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <HomeIcon className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-xs text-gray-400">Accueil</span>
          </button>

          <button
            onClick={() => onNavigate('explorer')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <Compass className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-xs text-gray-400">Explorer</span>
          </button>

          <button
            onClick={() => onNavigate('create-event')}
            className="flex flex-col items-center gap-1 -mt-4"
          >
            <div className="w-14 h-14 rounded-full bg-[#9747FF] flex items-center justify-center shadow-lg">
              <span className="text-white text-2xl">+</span>
            </div>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-[#FF9F1C]" />
            </div>
            <span className="text-xs text-[#FF9F1C]">Messages</span>
          </button>

          <button
            onClick={() => onNavigate('profile')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-10 h-10 flex items-center justify-center">
              <User className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-xs text-gray-400">Profil</span>
          </button>
        </div>

        <div className="flex items-center justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}

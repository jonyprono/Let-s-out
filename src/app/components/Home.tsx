import { useState } from 'react';
import { Search, Bell, Home as HomeIcon, Compass, MessageCircle, User, MapPin, Calendar, Users } from 'lucide-react';

interface HomeProps {
  userData: any;
  onNavigate: (screen: string) => void;
}

const mockEvents = [
  {
    id: 1,
    title: 'Soirée cinéma entre amis',
    location: 'Paris 11ème',
    date: 'Ce soir • 20:00',
    price: '12€',
    participants: 8,
    category: 'Général',
    image: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&h=200&fit=crop',
  },
  {
    id: 2,
    title: 'Running au Parc Monceau',
    location: 'Paris 8ème',
    date: 'Demain • 08:00',
    price: 'Gratuit',
    participants: 15,
    category: 'À venir',
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=400&h=200&fit=crop',
  },
  {
    id: 3,
    title: 'Brunch du dimanche',
    location: 'Paris 10ème',
    date: 'Dimanche • 11:00',
    price: '25€',
    participants: 6,
    category: 'À venir',
    image: 'https://images.unsplash.com/photo-1464979681340-bdd28a61699e?w=400&h=200&fit=crop',
  },
  {
    id: 4,
    title: 'Concert Jazz',
    location: 'Paris 1er',
    date: 'Vendredi • 21:00',
    price: '18€',
    participants: 20,
    category: 'À venir',
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=400&h=200&fit=crop',
  },
];

export function Home({ userData, onNavigate }: HomeProps) {
  const [activeFilter, setActiveFilter] = useState('Général');
  const filters = ['Général', 'À venir', 'Accompagné', 'Passé'];

  const filteredEvents = mockEvents.filter(event =>
    activeFilter === 'Général' || event.category === activeFilter
  );

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
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl">Accueil</h1>
            <p className="text-sm text-gray-500">
              Bonjour {userData?.firstName || 'utilisateur'} 👋
            </p>
          </div>
          <button
            onClick={() => onNavigate('notifications')}
            className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center relative"
          >
            <Bell className="w-5 h-5 text-blue-500" />
            <div className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
          </button>
        </div>

        {/* Search Bar */}
        <button
          onClick={() => onNavigate('explorer')}
          className="w-full px-4 py-3 bg-gray-100 rounded-full flex items-center gap-3 text-gray-400"
        >
          <Search className="w-5 h-5" />
          <span className="text-sm">Trouver une sortie...</span>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Vos groupes */}
        <div className="px-6 mb-6">
          <h2 className="text-lg mb-3">Vos groupes</h2>
          <div className="bg-gray-50 rounded-2xl p-6 text-center">
            <p className="text-sm text-gray-400">Aucun groupe pour le moment</p>
          </div>
        </div>

        {/* Vos événements */}
        <div className="px-6">
          <h2 className="text-lg mb-3">Vos événements</h2>

          {/* Filters */}
          <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
            {filters.map((filter) => (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                  activeFilter === filter
                    ? 'bg-[#FF9F1C] text-white'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Events Grid */}
          <div className="space-y-4">
            {filteredEvents.map((event) => (
              <button
                key={event.id}
                onClick={() => onNavigate('event-details')}
                className="w-full bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
              >
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-40 object-cover"
                />
                <div className="p-4">
                  <h3 className="text-left mb-2">{event.title}</h3>
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{event.location}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{event.date}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1 text-sm">
                      <Users className="w-4 h-4 text-gray-400" />
                      <span className="text-gray-600">{event.participants}</span>
                    </div>
                    <span className="text-[#9747FF]">{event.price}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pt-3 pb-2">
        <div className="flex items-center justify-between">
          <button className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center">
              <HomeIcon className="w-5 h-5 text-[#FF9F1C]" />
            </div>
            <span className="text-xs text-[#FF9F1C]">Accueil</span>
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

          <button
            onClick={() => onNavigate('messages')}
            className="flex flex-col items-center gap-1"
          >
            <div className="w-10 h-10 flex items-center justify-center relative">
              <MessageCircle className="w-5 h-5 text-gray-400" />
              <div className="absolute top-0 right-0 w-2 h-2 bg-red-500 rounded-full" />
            </div>
            <span className="text-xs text-gray-400">Messages</span>
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

        {/* Home Indicator */}
        <div className="flex items-center justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}

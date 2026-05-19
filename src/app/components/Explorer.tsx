import { useState } from 'react';
import { Search, SlidersHorizontal, MapPin, Calendar, Users, Home as HomeIcon, Compass, MessageCircle, User } from 'lucide-react';

interface ExplorerProps {
  onNavigate: (screen: string) => void;
}

const mockEvents = [
  {
    id: 1,
    title: 'After-work Networking',
    location: 'Paris 2ème',
    date: 'Jeudi • 19:00',
    price: '15€',
    participants: 12,
    category: 'Business',
    image: 'https://images.unsplash.com/photo-1556761175-b413da4baf72?w=400&h=200&fit=crop',
  },
  {
    id: 2,
    title: 'Soirée salsa',
    location: 'Paris 11ème',
    date: 'Samedi • 21:00',
    price: '10€',
    participants: 30,
    category: 'Nightlife',
    image: 'https://images.unsplash.com/photo-1504609813442-a8924e83f76e?w=400&h=200&fit=crop',
  },
  {
    id: 3,
    title: 'Visite du Louvre',
    location: 'Paris 1er',
    date: 'Dimanche • 14:00',
    price: '17€',
    participants: 8,
    category: 'Culture',
    image: 'https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=400&h=200&fit=crop',
  },
  {
    id: 4,
    title: 'Yoga en plein air',
    location: 'Paris 16ème',
    date: 'Mercredi • 18:30',
    price: 'Gratuit',
    participants: 20,
    category: 'Sport',
    image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=200&fit=crop',
  },
  {
    id: 5,
    title: 'Dégustation de vin',
    location: 'Paris 6ème',
    date: 'Vendredi • 20:00',
    price: '35€',
    participants: 10,
    category: 'Food',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?w=400&h=200&fit=crop',
  },
];

const categories = ['Tous', 'Sport', 'Culture', 'Food', 'Business', 'Nightlife'];

export function Explorer({ onNavigate }: ExplorerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('Tous');

  const filteredEvents = mockEvents.filter(event => {
    const matchesSearch = event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'Tous' || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

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
        <h1 className="text-2xl mb-4">Explorer</h1>

        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="flex-1 px-4 py-3 bg-gray-100 rounded-full flex items-center gap-3">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une sortie..."
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-12 h-12 bg-[#9747FF] rounded-full flex items-center justify-center"
          >
            <SlidersHorizontal className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm whitespace-nowrap transition-colors ${
                selectedCategory === category
                  ? 'bg-[#FF9F1C] text-white'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="px-6 pb-4 border-b border-gray-100">
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Distance</label>
              <select className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <option>5 km</option>
                <option>10 km</option>
                <option>20 km</option>
                <option>50 km</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Prix maximum</label>
              <select className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <option>Gratuit</option>
                <option>Moins de 20€</option>
                <option>Moins de 50€</option>
                <option>Tous</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Date</label>
              <select className="w-full px-3 py-2 bg-gray-50 rounded-lg text-sm">
                <option>Aujourd'hui</option>
                <option>Cette semaine</option>
                <option>Ce mois-ci</option>
                <option>Toutes</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-20">
        <div className="space-y-4 py-4">
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
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-left flex-1">{event.title}</h3>
                  <span className="text-sm bg-purple-50 text-[#9747FF] px-2 py-1 rounded-full">
                    {event.category}
                  </span>
                </div>
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
                    <span className="text-gray-600">{event.participants} participants</span>
                  </div>
                  <span className="text-[#9747FF]">{event.price}</span>
                </div>
              </div>
            </button>
          ))}
        </div>
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

          <button className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <Compass className="w-5 h-5 text-[#9747FF]" />
            </div>
            <span className="text-xs text-[#9747FF]">Explorer</span>
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
            <div className="w-10 h-10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-gray-400" />
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

        <div className="flex items-center justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}

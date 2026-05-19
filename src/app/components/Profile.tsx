import { Settings, Calendar, Users, Heart, Home as HomeIcon, Compass, MessageCircle, User } from 'lucide-react';

interface ProfileProps {
  onNavigate: (screen: string) => void;
}

const userInterests = ['Sorties', 'Sport', 'Cinéma', 'Food', 'Musique', 'Culture'];

const pastEvents = [
  {
    id: 1,
    title: 'Concert Jazz',
    date: '20 avril',
    image: 'https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?w=300&h=200&fit=crop',
  },
  {
    id: 2,
    title: 'Brunch convivial',
    date: '15 avril',
    image: 'https://images.unsplash.com/photo-1464979681340-bdd28a61699e?w=300&h=200&fit=crop',
  },
  {
    id: 3,
    title: 'Running matinal',
    date: '10 avril',
    image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=300&h=200&fit=crop',
  },
];

export function Profile({ onNavigate }: ProfileProps) {
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
      <div className="px-6 py-4 flex items-center justify-between">
        <h1 className="text-2xl">Profil</h1>
        <button
          onClick={() => onNavigate('settings')}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <Settings className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-20">
        {/* Profile Header */}
        <div className="flex flex-col items-center text-center mb-8">
          <img
            src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop"
            alt="Profile"
            className="w-24 h-24 rounded-full object-cover mb-4"
          />
          <h2 className="text-xl mb-1">Thomas Dupont</h2>
          <p className="text-sm text-gray-500 mb-4">Membre depuis janvier 2025</p>

          <div className="flex gap-6">
            <div className="text-center">
              <p className="text-xl text-[#9747FF]">24</p>
              <p className="text-xs text-gray-500">Amis</p>
            </div>
            <div className="text-center">
              <p className="text-xl text-[#FF9F1C]">12</p>
              <p className="text-xs text-gray-500">Événements</p>
            </div>
            <div className="text-center">
              <p className="text-xl text-pink-500">8</p>
              <p className="text-xs text-gray-500">Créés</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-6">
          <h3 className="text-sm mb-2">À propos</h3>
          <p className="text-sm text-gray-600 leading-relaxed">
            Passionné de sorties culturelles et sportives. Toujours partant pour découvrir de nouveaux
            endroits et rencontrer de nouvelles personnes !
          </p>
        </div>

        {/* Interests */}
        <div className="mb-6">
          <h3 className="text-sm mb-3">Centres d'intérêt</h3>
          <div className="flex flex-wrap gap-2">
            {userInterests.map((interest) => (
              <div
                key={interest}
                className="px-4 py-2 bg-purple-50 text-[#9747FF] rounded-full text-sm"
              >
                {interest}
              </div>
            ))}
          </div>
        </div>

        {/* Past Events */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm">Événements passés</h3>
            <button className="text-xs text-[#9747FF]">Voir tout</button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {pastEvents.map((event) => (
              <div key={event.id} className="relative rounded-lg overflow-hidden">
                <img
                  src={event.image}
                  alt={event.title}
                  className="w-full h-24 object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex items-end p-2">
                  <div className="text-white">
                    <p className="text-xs leading-tight">{event.title}</p>
                    <p className="text-xs text-white/70">{event.date}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-orange-50 rounded-2xl p-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-2">
              <Calendar className="w-5 h-5 text-[#FF9F1C]" />
            </div>
            <p className="text-2xl mb-1">32</p>
            <p className="text-xs text-gray-600">Participations</p>
          </div>

          <div className="bg-purple-50 rounded-2xl p-4">
            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center mb-2">
              <Heart className="w-5 h-5 text-[#9747FF]" />
            </div>
            <p className="text-2xl mb-1">18</p>
            <p className="text-xs text-gray-600">Favoris</p>
          </div>
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
            <div className="w-10 h-10 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-gray-400" />
            </div>
            <span className="text-xs text-gray-400">Messages</span>
          </button>

          <button className="flex flex-col items-center gap-1">
            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center">
              <User className="w-5 h-5 text-[#9747FF]" />
            </div>
            <span className="text-xs text-[#9747FF]">Profil</span>
          </button>
        </div>

        <div className="flex items-center justify-center mt-2">
          <div className="w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}

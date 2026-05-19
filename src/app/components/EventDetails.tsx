import { ChevronLeft, MapPin, Calendar, Users, Share2, Heart, MessageCircle } from 'lucide-react';

interface EventDetailsProps {
  onBack: () => void;
}

export function EventDetails({ onBack }: EventDetailsProps) {
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
      <div className="absolute top-11 left-0 right-0 z-10 px-6 py-4 flex items-center justify-between">
        <button
          onClick={onBack}
          className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex gap-2">
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <Share2 className="w-5 h-5" />
          </button>
          <button className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-md">
            <Heart className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Event Image */}
        <img
          src="https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800&h=400&fit=crop"
          alt="Event"
          className="w-full h-64 object-cover"
        />

        <div className="px-6 py-6">
          {/* Event Title */}
          <h1 className="text-2xl mb-4">Soirée cinéma entre amis</h1>

          {/* Event Info */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-10 h-10 bg-purple-50 rounded-full flex items-center justify-center">
                <Calendar className="w-5 h-5 text-[#9747FF]" />
              </div>
              <div>
                <p className="text-sm">Ce soir • 20:00</p>
                <p className="text-xs text-gray-400">28 avril 2026</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center">
                <MapPin className="w-5 h-5 text-[#FF9F1C]" />
              </div>
              <div>
                <p className="text-sm">Cinéma MK2 Bastille</p>
                <p className="text-xs text-gray-400">11 boulevard Beaumarchais, 75011 Paris</p>
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-600">
              <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm">8 participants</p>
                <p className="text-xs text-gray-400">12 places maximum</p>
              </div>
            </div>
          </div>

          {/* Organizer */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-500 mb-3">Organisateur</h3>
            <div className="flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"
                alt="Organizer"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div>
                <p className="text-sm">Thomas Dubois</p>
                <p className="text-xs text-gray-400">Membre depuis 2025</p>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-500 mb-2">Description</h3>
            <p className="text-sm text-gray-700 leading-relaxed">
              Rejoignez-nous pour une soirée cinéma conviviale ! Nous allons voir le dernier film
              d'action au MK2 Bastille. Après la séance, on peut aller prendre un verre pour échanger
              sur le film. Ambiance décontractée et bonne humeur garanties ! 🍿🎬
            </p>
          </div>

          {/* Participants */}
          <div className="mb-6">
            <h3 className="text-sm text-gray-500 mb-3">Participants (8)</h3>
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="w-10 h-10 rounded-full bg-gray-200 border-2 border-white"
                />
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="bg-purple-50 rounded-2xl p-4 mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Prix par personne</p>
                <p className="text-2xl text-[#9747FF]">12€</p>
              </div>
              <button className="px-4 py-2 bg-white rounded-full text-sm text-[#9747FF]">
                Cagnotte partagée
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Actions */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
        <div className="flex gap-3 mb-2">
          <button className="flex-1 bg-[#FF9F1C] text-white py-3.5 rounded-full">
            Participer
          </button>
          <button className="w-14 h-14 bg-purple-50 rounded-full flex items-center justify-center">
            <MessageCircle className="w-6 h-6 text-[#9747FF]" />
          </button>
        </div>

        <div className="flex items-center justify-center">
          <div className="w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}

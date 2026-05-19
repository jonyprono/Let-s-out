import { ChevronLeft, Heart, MessageCircle, UserPlus, Calendar, DollarSign } from 'lucide-react';

interface NotificationsProps {
  onBack: () => void;
}

const mockNotifications = [
  {
    id: 1,
    type: 'invitation',
    icon: Calendar,
    color: 'purple',
    title: 'Nouvelle invitation',
    message: 'Sarah Martin vous a invité à "Brunch du dimanche"',
    time: 'Il y a 5 min',
    unread: true,
  },
  {
    id: 2,
    type: 'message',
    icon: MessageCircle,
    color: 'orange',
    title: 'Nouveau message',
    message: 'Alex Dupont a envoyé un message dans "Running Club"',
    time: 'Il y a 1h',
    unread: true,
  },
  {
    id: 3,
    type: 'friend',
    icon: UserPlus,
    color: 'blue',
    title: 'Nouvelle demande',
    message: 'Marie Lefebvre souhaite vous ajouter en ami',
    time: 'Il y a 2h',
    unread: false,
  },
  {
    id: 4,
    type: 'event',
    icon: Heart,
    color: 'pink',
    title: 'Événement bientôt',
    message: 'Rappel: "Soirée cinéma" commence dans 3 heures',
    time: 'Il y a 3h',
    unread: false,
  },
  {
    id: 5,
    type: 'payment',
    icon: DollarSign,
    color: 'green',
    title: 'Paiement reçu',
    message: 'Thomas a contribué 15€ à la cagnotte "Brunch"',
    time: 'Hier',
    unread: false,
  },
];

const colorClasses: any = {
  purple: 'bg-purple-50 text-[#9747FF]',
  orange: 'bg-orange-50 text-[#FF9F1C]',
  blue: 'bg-blue-50 text-blue-500',
  pink: 'bg-pink-50 text-pink-500',
  green: 'bg-green-50 text-green-500',
};

export function Notifications({ onBack }: NotificationsProps) {
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
      <div className="px-6 py-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <button onClick={onBack}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg">Notifications</h1>
          <button className="text-sm text-[#9747FF]">Tout lire</button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        {mockNotifications.map((notification) => {
          const Icon = notification.icon;
          return (
            <button
              key={notification.id}
              className={`w-full px-6 py-4 flex items-start gap-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                notification.unread ? 'bg-blue-50/30' : ''
              }`}
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${colorClasses[notification.color]}`}>
                <Icon className="w-6 h-6" />
              </div>

              <div className="flex-1 text-left">
                <div className="flex items-start justify-between mb-1">
                  <h3 className="text-sm">
                    {notification.title}
                    {notification.unread && (
                      <span className="ml-2 w-2 h-2 bg-blue-500 rounded-full inline-block" />
                    )}
                  </h3>
                  <span className="text-xs text-gray-400 ml-2">{notification.time}</span>
                </div>
                <p className="text-sm text-gray-600">{notification.message}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Home Indicator */}
      <div className="h-8 flex items-center justify-center pb-2">
        <div className="w-32 h-1 bg-black rounded-full" />
      </div>
    </div>
  );
}

import { ChevronLeft, ChevronRight, Globe, Lock, Bell, Shield, HelpCircle, LogOut } from 'lucide-react';

interface SettingsProps {
  onBack: () => void;
}

const settingsOptions = [
  {
    id: 'language',
    icon: Globe,
    title: 'Langue',
    subtitle: 'Français',
    color: 'blue',
  },
  {
    id: 'security',
    icon: Lock,
    title: 'Sécurité',
    subtitle: 'Mot de passe, authentification',
    color: 'purple',
  },
  {
    id: 'notifications',
    icon: Bell,
    title: 'Notifications',
    subtitle: 'Gérer vos préférences',
    color: 'orange',
  },
  {
    id: 'privacy',
    icon: Shield,
    title: 'Confidentialité',
    subtitle: 'Données personnelles',
    color: 'green',
  },
  {
    id: 'support',
    icon: HelpCircle,
    title: 'Support',
    subtitle: 'Aide et contact',
    color: 'pink',
  },
];

const colorClasses: any = {
  blue: 'bg-blue-50 text-blue-500',
  purple: 'bg-purple-50 text-[#9747FF]',
  orange: 'bg-orange-50 text-[#FF9F1C]',
  green: 'bg-green-50 text-green-500',
  pink: 'bg-pink-50 text-pink-500',
};

export function Settings({ onBack }: SettingsProps) {
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
        <div className="flex items-center gap-4">
          <button onClick={onBack}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg">Paramètres</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {/* Account Section */}
        <div className="mb-6">
          <h3 className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Compte</h3>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <button className="w-full px-4 py-4 flex items-center gap-3">
              <img
                src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&h=100&fit=crop"
                alt="Profile"
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1 text-left">
                <p className="text-sm">Thomas Dupont</p>
                <p className="text-xs text-gray-500">Modifier le profil</p>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Settings Options */}
        <div className="mb-6">
          <h3 className="text-xs text-gray-500 mb-3 uppercase tracking-wide">Préférences</h3>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            {settingsOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  className="w-full px-4 py-4 flex items-center gap-3 hover:bg-gray-50 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${colorClasses[option.color]}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 text-left">
                    <p className="text-sm">{option.title}</p>
                    <p className="text-xs text-gray-500">{option.subtitle}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400" />
                </button>
              );
            })}
          </div>
        </div>

        {/* About */}
        <div className="mb-6">
          <h3 className="text-xs text-gray-500 mb-3 uppercase tracking-wide">À propos</h3>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden divide-y divide-gray-100">
            <button className="w-full px-4 py-4 flex items-center justify-between">
              <span className="text-sm">Version</span>
              <span className="text-sm text-gray-500">1.0.0</span>
            </button>

            <button className="w-full px-4 py-4 flex items-center justify-between">
              <span className="text-sm">Conditions d'utilisation</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>

            <button className="w-full px-4 py-4 flex items-center justify-between">
              <span className="text-sm">Politique de confidentialité</span>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Logout */}
        <button className="w-full bg-red-50 text-red-500 py-4 rounded-2xl flex items-center justify-center gap-2">
          <LogOut className="w-5 h-5" />
          <span className="text-sm">Se déconnecter</span>
        </button>
      </div>

      {/* Home Indicator */}
      <div className="h-8 flex items-center justify-center pb-2">
        <div className="w-32 h-1 bg-black rounded-full" />
      </div>
    </div>
  );
}

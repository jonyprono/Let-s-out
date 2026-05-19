import { useState } from 'react';
import { ChevronLeft, Upload, MapPin, Calendar, Clock, Users } from 'lucide-react';

interface CreateEventProps {
  onBack: () => void;
}

export function CreateEvent({ onBack }: CreateEventProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [price, setPrice] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [sharedPayment, setSharedPayment] = useState(false);

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
          <h1 className="text-lg">Créer un événement</h1>
          <div className="w-6" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-24">
        {/* Image Upload */}
        <div className="mb-6">
          <label className="text-sm text-gray-600 mb-2 block">Photo de l'événement</label>
          <div className="w-full h-40 bg-gray-100 rounded-2xl flex items-center justify-center border-2 border-dashed border-gray-300">
            <div className="text-center">
              <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Ajouter une photo</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="space-y-4">
          <div>
            <label className="text-sm text-gray-600 mb-2 block">Titre</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Brunch entre amis"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Décrivez votre événement..."
              rows={4}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF] resize-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Catégorie</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF] bg-white"
            >
              <option value="">Sélectionner une catégorie</option>
              <option value="sport">Sport</option>
              <option value="culture">Culture</option>
              <option value="food">Food</option>
              <option value="business">Business</option>
              <option value="nightlife">Nightlife</option>
              <option value="autre">Autre</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Date</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">Heure</label>
              <div className="relative">
                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-sm text-gray-600 mb-2 block">Lieu</label>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Adresse ou lieu"
                className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-600 mb-2 block">Participants max</label>
              <div className="relative">
                <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  placeholder="10"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-600 mb-2 block">Prix (€)</label>
              <input
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="0"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
              />
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3 pt-2">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-5 h-5 accent-[#9747FF]"
              />
              <span className="text-sm text-gray-700">Événement privé (sur invitation)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={sharedPayment}
                onChange={(e) => setSharedPayment(e.target.checked)}
                className="w-5 h-5 accent-[#9747FF]"
              />
              <span className="text-sm text-gray-700">Activer le paiement partagé</span>
            </label>
          </div>
        </div>
      </div>

      {/* Bottom Button */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 py-4">
        <button className="w-full bg-[#FF9F1C] text-white py-3.5 rounded-full mb-2">
          Créer l'événement
        </button>

        <div className="flex items-center justify-center">
          <div className="w-32 h-1 bg-black rounded-full" />
        </div>
      </div>
    </div>
  );
}

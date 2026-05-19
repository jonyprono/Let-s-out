import { useState } from 'react';
import { ChevronLeft, Upload } from 'lucide-react';

interface OnboardingProps {
  onComplete: (data: any) => void;
}

const interests = [
  'Sorties', 'Sport', 'Cinéma', 'Voyage', 'Food', 'Business',
  'Networking', 'Nightlife', 'Musique', 'Culture', 'Art', 'Tech'
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [country, setCountry] = useState('France');
  const [city, setCity] = useState('');
  const [district, setDistrict] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [profilePicture, setProfilePicture] = useState('');

  const toggleInterest = (interest: string) => {
    setSelectedInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  const handleNext = () => {
    if (step === 4) {
      onComplete({
        firstName,
        lastName,
        gender,
        birthDate,
        country,
        city,
        district,
        interests: selectedInterests,
        profilePicture,
      });
    } else {
      setStep(step + 1);
    }
  };

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
          {step > 1 && (
            <button onClick={() => setStep(step - 1)}>
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}
          <h1 className="text-lg">Onboarding</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-8 overflow-y-auto">
        {/* Step 1: Personal Info */}
        {step === 1 && (
          <div>
            <h2 className="text-xl mb-6">Informations personnelles</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Entrez votre prénom"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Entrez votre nom"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Sexe</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF] bg-white"
                >
                  <option value="">Sélectionner</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Date de naissance</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div>
            <h2 className="text-xl mb-6">Où habitez-vous ?</h2>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-600 mb-2 block">Pays</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF] bg-white"
                >
                  <option value="France">France</option>
                  <option value="Belgique">Belgique</option>
                  <option value="Suisse">Suisse</option>
                  <option value="Canada">Canada</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris, Lyon, Marseille..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>

              <div>
                <label className="text-sm text-gray-600 mb-2 block">Quartier</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Nom du quartier"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Interests */}
        {step === 3 && (
          <div>
            <h2 className="text-xl mb-2">Vos centres d'intérêt</h2>
            <p className="text-sm text-gray-500 mb-6">
              Sélectionnez au moins 3 centres d'intérêt
            </p>

            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-5 py-2.5 rounded-full border-2 text-sm transition-colors ${
                    selectedInterests.includes(interest)
                      ? 'border-[#9747FF] bg-purple-50 text-[#9747FF]'
                      : 'border-gray-300 text-gray-600'
                  }`}
                >
                  {interest}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Profile Picture */}
        {step === 4 && (
          <div>
            <h2 className="text-xl mb-2">Photo de profil</h2>
            <p className="text-sm text-gray-500 mb-6">
              Ajoutez une photo pour que les autres vous reconnaissent
            </p>

            <div className="flex flex-col items-center">
              <div className="w-40 h-40 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center mb-4 overflow-hidden">
                {profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <Upload className="w-12 h-12 text-gray-400" />
                )}
              </div>
              <button
                onClick={() => setProfilePicture('https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&h=200&fit=crop')}
                className="text-[#9747FF] text-sm"
              >
                Choisir une photo
              </button>
              <p className="text-xs text-gray-400 mt-2">
                Vous pourrez la modifier plus tard
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="px-6 pb-6 pt-4 border-t border-gray-100">
        <button
          onClick={handleNext}
          disabled={step === 3 && selectedInterests.length < 3}
          className="w-full bg-[#FF9F1C] text-white py-3.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === 4 ? 'Terminer' : 'Suivant'}
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="px-6 pb-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4].map((s) => (
            <div
              key={s}
              className={`flex-1 h-1 rounded-full ${
                s <= step ? 'bg-[#9747FF]' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Home Indicator */}
      <div className="h-8 flex items-center justify-center pb-2">
        <div className="w-32 h-1 bg-black rounded-full" />
      </div>
    </div>
  );
}

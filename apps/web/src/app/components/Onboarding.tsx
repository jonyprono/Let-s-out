import { useState, useRef } from 'react';
import { ChevronLeft, MapPin, Loader2, User, Camera } from 'lucide-react';
import { toast } from 'sonner';
import { COUNTRIES } from '@/lib/countries';
import { useAuthStore } from '@/stores/auth.store';

async function reverseGeocode(lat: number, lon: number) {
  const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&addressdetails=1`, { headers: { 'Accept-Language': 'fr' } });
  const d = await r.json();
  const a = d.address;
  return {
    city: a.city || a.town || a.village || a.county || '',
    district: a.suburb || a.neighbourhood || a.quarter || '',
    country: a.country || 'Bénin',
  };
}

interface OnboardingProps {
  onComplete: (data: any) => void;
}

const interests = [
  'Sorties', 'Sport', 'Cinéma', 'Voyage', 'Food', 'Business',
  'Networking', 'Nightlife', 'Musique', 'Culture', 'Art', 'Tech'
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const accessToken = useAuthStore((s) => s.accessToken);
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
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      try {
        const { city: c, district: d, country: co } = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
        if (c) setCity(c);
        if (d) setDistrict(d);
        if (co) {
          // Si le pays n'est pas dans la liste par défaut, on peut l'ajouter ou juste le set
          setCountry(co);
        }
        toast.success("Localisation réussie !");
      } catch (err) {
        toast.error("Impossible de récupérer l'adresse.");
      } finally {
        setIsLocating(false);
      }
    }, () => {
      toast.error("Impossible d'accéder à la géolocalisation.");
      setIsLocating(false);
    }, { timeout: 10000 });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Format non supporté. Utilisez JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image trop grande (max 5 Mo).');
      return;
    }
    setIsUploadingPhoto(true);
    try {
      const resolveApiBase = () => {
        const envUrl = import.meta.env.VITE_API_URL as string | undefined
        if (envUrl) return envUrl.replace('/api/v1', '')
        if (typeof window !== 'undefined' && window.location && window.location.origin) {
          const origin = window.location.origin
          if (origin.includes(':3000')) {
            return origin.replace(':3000', ':3001')
          }
          return `${origin}`
        }
        return 'http://localhost:3001'
      }
      const apiBase = resolveApiBase()
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(
        `${apiBase}/api/v1/chat/upload`,
        {
          method: 'POST',
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
          body: formData,
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      // Store relative path — SafeImage resolves against API base on any device
      setProfilePicture(data.url);
      toast.success('Photo ajoutée !');
    } catch (e: any) {
      toast.error(e.message || 'Erreur lors de l\'upload');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

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
    <div className="w-full h-full bg-background-default flex flex-col">
      {/* Status Bar */}
      <div className="h-11 flex items-center justify-between px-6">
        <span className="text-sm">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-black rounded-sm" />
        </div>
      </div>

      {/* Header */}
      <div className="px-6 py-200 border-b border-gray-100">
        <div className="flex items-center gap-200">
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

            <div className="space-y-200">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Prénom</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Entrez votre prénom"
                  className="app-input"
                />
              </div>

              <div>
                <label className="text-sm text-text-secondary mb-2 block">Nom</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Entrez votre nom"
                  className="app-input"
                />
              </div>

              <div>
                <label className="text-sm text-text-secondary mb-2 block">Sexe</label>
                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className="app-input"
                >
                  <option value="">Sélectionner</option>
                  <option value="homme">Homme</option>
                  <option value="femme">Femme</option>
                  <option value="autre">Autre</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-text-secondary mb-2 block">Date de naissance</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="app-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Address */}
        {step === 2 && (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl">Où habitez-vous ?</h2>
              <button 
                onClick={handleLocate}
                disabled={isLocating}
                className="flex items-center gap-2 text-sm font-medium text-action-primary bg-brand-orange-50 px-150 py-1.5 rounded-full active:scale-95 transition-transform"
              >
                {isLocating ? <Loader2 className="w-4 h-4 animate-spin" /> : <MapPin className="w-4 h-4" />}
                Me localiser
              </button>
            </div>

            <div className="space-y-200">
              <div>
                <label className="text-sm text-text-secondary mb-2 block">Pays</label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="app-input"
                >
                  {COUNTRIES.map(c => (
                    <option key={c.cca2} value={c.name}>{c.name}</option>
                  ))}
                  {!COUNTRIES.find(c => c.name === country) && country && (
                    <option value={country}>{country}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-sm text-text-secondary mb-2 block">Ville</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Paris, Lyon, Marseille..."
                  className="app-input"
                />
              </div>

              <div>
                <label className="text-sm text-text-secondary mb-2 block">Quartier</label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="Nom du quartier"
                  className="app-input"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Interests */}
        {step === 3 && (
          <div>
            <h2 className="text-xl mb-2">Vos centres d'intérêt</h2>
            <p className="text-sm text-text-secondary mb-6">
              Sélectionnez au moins 3 centres d'intérêt
            </p>

            <div className="flex flex-wrap gap-2">
              {interests.map((interest) => (
                <button
                  key={interest}
                  onClick={() => toggleInterest(interest)}
                  className={`px-5 py-2.5 rounded-full border-2 text-sm transition-colors ${
                    selectedInterests.includes(interest)
                      ? 'border-action-primary bg-brand-orange-50 text-action-primary'
                      : 'border-border-primary text-text-secondary'
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
            <p className="text-sm text-text-secondary mb-6">
              Ajoutez une photo pour que les autres vous reconnaissent
            </p>

            <div className="flex flex-col items-center">
              {/* Avatar preview */}
              <div
                className="w-40 h-40 rounded-full bg-gray-100 border-2 border-dashed border-border-primary flex items-center justify-center mb-200 overflow-hidden relative cursor-pointer active:scale-95 transition-transform"
                onClick={() => fileInputRef.current?.click()}
              >
                {isUploadingPhoto ? (
                  <Loader2 className="w-10 h-10 animate-spin text-action-primary" />
                ) : profilePicture ? (
                  <img src={profilePicture} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <User className="w-12 h-12 text-gray-400" />
                    <Camera className="w-5 h-5 text-gray-300" />
                  </div>
                )}
                {/* Camera overlay on hover */}
                {profilePicture && !isUploadingPhoto && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <Camera className="w-8 h-8 text-white" />
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handlePhotoUpload(file);
                }}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="text-action-primary text-sm font-semibold bg-brand-orange-50 px-200 py-2 rounded-full active:scale-95 transition-transform disabled:opacity-50"
              >
                {isUploadingPhoto ? 'Upload en cours...' : profilePicture ? 'Changer la photo' : 'Choisir une photo'}
              </button>
              <p className="text-xs text-gray-400 mt-2">
                {profilePicture ? 'Appuyez pour modifier' : 'Vous pourrez la modifier plus tard'}
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
          className="w-full bg-action-primary active:bg-action-primary-hover text-white py-150.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
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
                s <= step ? 'bg-action-primary active:bg-action-primary-hover' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

    </div>
  );
}

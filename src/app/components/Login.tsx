import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface LoginProps {
  onLogin: () => void;
  onSignup: () => void;
}

export function Login({ onLogin, onSignup }: LoginProps) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countryCode, setCountryCode] = useState('+33');

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Status Bar */}
      <div className="h-11 flex items-center justify-between px-6">
        <span className="text-sm">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-black rounded-sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-8 flex flex-col">
        {/* Logo */}
        <div className="mb-12 flex justify-center">
          <div className="text-center">
            <svg width="80" height="80" viewBox="0 0 120 120" className="mx-auto mb-3">
              <path d="M60 110L45 85L30 95L35 70L15 60L35 50L30 25L45 35L60 10L75 35L90 25L85 50L105 60L85 70L90 95L75 85L60 110Z" fill="#9747FF"/>
              <circle cx="45" cy="45" r="8" fill="#FF9F1C"/>
              <circle cx="75" cy="45" r="8" fill="#FF9F1C"/>
              <circle cx="60" cy="70" r="8" fill="#FF9F1C"/>
            </svg>
            <h1 className="text-xl">
              <span className="text-[#FF9F1C]">Let's</span>{' '}
              <span className="text-[#9747FF]">Out</span>
            </h1>
          </div>
        </div>

        {/* Form Title */}
        <div className="mb-6">
          <h2 className="text-2xl mb-2 text-primary">Connectez-vous</h2>
          <p className="text-sm text-gray-500">Entrez vos informations pour continuer</p>
        </div>

        {/* Phone Number */}
        <div className="mb-4">
          <label className="text-sm text-gray-600 mb-2 block">Numéro de téléphone</label>
          <div className="flex gap-2">
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-20 px-3 py-3 border border-gray-300 rounded-xl bg-white"
            >
              <option value="+33">🇫🇷 +33</option>
              <option value="+1">🇺🇸 +1</option>
              <option value="+44">🇬🇧 +44</option>
            </select>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="6 12 34 56 78"
              className="flex-1 px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
            />
          </div>
        </div>

        {/* Password */}
        <div className="mb-2">
          <label className="text-sm text-gray-600 mb-2 block">Mot de passe</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Forgot Password */}
        <button className="text-sm text-[#9747FF] mb-8 text-right">
          Mot de passe oublié ?
        </button>

        {/* Login Button */}
        <button
          onClick={onLogin}
          className="w-full bg-[#FF9F1C] text-white py-3.5 rounded-full mb-4"
        >
          Se connecter
        </button>

        {/* Signup Link */}
        <div className="text-center text-sm text-gray-600">
          Vous n'avez pas de compte ?{' '}
          <button onClick={onSignup} className="text-[#9747FF]">
            Créer un compte
          </button>
        </div>
      </div>

      {/* Home Indicator */}
      <div className="h-8 flex items-center justify-center pb-2">
        <div className="w-32 h-1 bg-black rounded-full" />
      </div>
    </div>
  );
}

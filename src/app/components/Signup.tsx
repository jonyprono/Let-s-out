import { useState } from 'react';
import { ChevronLeft, Eye, EyeOff } from 'lucide-react';

interface SignupProps {
  onComplete: () => void;
  onBack: () => void;
}

export function Signup({ onComplete, onBack }: SignupProps) {
  const [step, setStep] = useState(1);
  const [phone, setPhone] = useState('');
  const [countryCode, setCountryCode] = useState('+33');
  const [verificationMethod, setVerificationMethod] = useState<'sms' | 'whatsapp'>('sms');
  const [otp, setOtp] = useState(['', '', '', '']);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length <= 1 && /^\d*$/.test(value)) {
      const newOtp = [...otp];
      newOtp[index] = value;
      setOtp(newOtp);

      if (value && index < 3) {
        const nextInput = document.getElementById(`otp-${index + 1}`);
        nextInput?.focus();
      }
    }
  };

  const handleNext = () => {
    if (step === 5) {
      onComplete();
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
          <button onClick={step === 1 ? onBack : () => setStep(step - 1)}>
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg">Inscription</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-6 pt-8 overflow-y-auto">
        {/* Step 1: Phone Number */}
        {step === 1 && (
          <div>
            <h2 className="text-xl mb-2">Quel est votre numéro de téléphone ?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Code de validation requis • <span className="text-[#9747FF]">SMS</span>
            </p>

            <label className="text-sm text-gray-600 mb-2 block">Numéro de téléphone</label>
            <div className="flex gap-2 mb-6">
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
        )}

        {/* Step 2: Verification Method */}
        {step === 2 && (
          <div>
            <h2 className="text-xl mb-2">Quel est le code reçu ?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Code de validation requis • <span className="text-[#9747FF]">{verificationMethod === 'sms' ? 'SMS' : 'WhatsApp'}</span>
            </p>

            <p className="text-sm text-gray-600 mb-4">Comment voulez-vous recevoir le code ?</p>

            <div className="space-y-3 mb-6">
              <button
                onClick={() => setVerificationMethod('sms')}
                className={`w-full px-4 py-4 rounded-xl border-2 flex items-center gap-3 ${
                  verificationMethod === 'sms'
                    ? 'border-[#9747FF] bg-purple-50'
                    : 'border-gray-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  verificationMethod === 'sms' ? 'border-[#9747FF]' : 'border-gray-300'
                }`}>
                  {verificationMethod === 'sms' && (
                    <div className="w-3 h-3 rounded-full bg-[#9747FF]" />
                  )}
                </div>
                <span className="text-sm">SMS</span>
              </button>

              <button
                onClick={() => setVerificationMethod('whatsapp')}
                className={`w-full px-4 py-4 rounded-xl border-2 flex items-center gap-3 ${
                  verificationMethod === 'whatsapp'
                    ? 'border-[#9747FF] bg-purple-50'
                    : 'border-gray-200'
                }`}
              >
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                  verificationMethod === 'whatsapp' ? 'border-[#9747FF]' : 'border-gray-300'
                }`}>
                  {verificationMethod === 'whatsapp' && (
                    <div className="w-3 h-3 rounded-full bg-[#9747FF]" />
                  )}
                </div>
                <span className="text-sm">WhatsApp</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 3: OTP Verification */}
        {step === 3 && (
          <div>
            <h2 className="text-xl mb-2">Quel est le code reçu ?</h2>
            <p className="text-sm text-gray-500 mb-6">
              Code de validation requis • <span className="text-[#9747FF]">{verificationMethod === 'sms' ? 'SMS' : 'WhatsApp'}</span>
            </p>

            <div className="flex gap-3 justify-center mb-6">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  id={`otp-${index}`}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  className="w-14 h-14 text-center text-xl border-2 border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
              ))}
            </div>

            <button className="text-sm text-[#9747FF] text-center w-full">
              Renvoyer le code
            </button>
          </div>
        )}

        {/* Step 4: Create Password */}
        {step === 4 && (
          <div>
            <h2 className="text-xl mb-2">Créez votre mot de passe</h2>
            <p className="text-sm text-gray-500 mb-6">
              Minimum 8 caractères avec au moins une majuscule et un chiffre
            </p>

            <div className="mb-4">
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

            <div className="mb-6">
              <label className="text-sm text-gray-600 mb-2 block">Confirmer le mot de passe</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:outline-none focus:border-[#9747FF]"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Terms & Conditions */}
        {step === 5 && (
          <div>
            <h2 className="text-xl mb-6">Conditions d'utilisation</h2>

            <div className="space-y-4 mb-6">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-[#9747FF]"
                />
                <span className="text-sm text-gray-600">
                  J'ai lu et j'accepte les conditions générales d'utilisation
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedPrivacy}
                  onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                  className="mt-1 w-5 h-5 accent-[#9747FF]"
                />
                <span className="text-sm text-gray-600">
                  J'accepte la politique de confidentialité
                </span>
              </label>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <p className="text-xs text-gray-600 leading-relaxed">
                En continuant, vous acceptez de recevoir des notifications concernant vos événements,
                messages et activités. Vous pourrez modifier ces paramètres à tout moment.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom Button */}
      <div className="px-6 pb-6 pt-4 border-t border-gray-100">
        <button
          onClick={handleNext}
          disabled={step === 5 && (!acceptedTerms || !acceptedPrivacy)}
          className="w-full bg-[#FF9F1C] text-white py-3.5 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === 5 ? 'Terminer' : 'Suivant'}
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="px-6 pb-2">
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((s) => (
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

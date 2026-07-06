import React from 'react';
import { Country } from '@/lib/countries';
import { CountryPicker } from '@/components/shared/CountryPicker';

interface PhoneInputFieldProps {
  country: Country;
  onCountryChange: (country: Country) => void;
  phoneDisplay: string;
  onPhoneChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onEnter?: () => void;
}

export function PhoneInputField({
  country,
  onCountryChange,
  phoneDisplay,
  onPhoneChange,
  onEnter
}: PhoneInputFieldProps) {
  return (
    // Aligné avec Input: min-h-[48px], rounded-[8px], border 1px → 2px orange au focus
    <div className="relative flex items-center w-full min-h-[48px] h-auto rounded-[8px] border border-[var(--border-default)] bg-white overflow-hidden box-border focus-within:border-2 focus-within:border-[var(--border-brand-primary)] transition-all duration-150">
      <CountryPicker
        value={country}
        onChange={onCountryChange}
        className="flex items-center gap-[8px] h-full pl-[1rem] pr-[0.5rem] bg-transparent whitespace-nowrap active:opacity-80 transition-colors shrink-0 outline-none text-[#1B1818] font-normal font-poppins text-[clamp(12px,3.5vw,14px)]"
      />
      {/* Séparateur vertical discret */}
      <div className="w-[1px] h-6 bg-[var(--border-default)] shrink-0" />
      <input
        type="tel"
        inputMode="numeric"
        value={phoneDisplay}
        onChange={onPhoneChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            onEnter();
          }
        }}
        placeholder="00 00 00 00 00"
        className="flex-1 min-w-0 h-full bg-transparent outline-none px-[1rem] text-[clamp(12px,3.5vw,14px)] font-normal font-poppins text-[#1B1818] placeholder:text-[#BDBDBD]"
      />
    </div>
  );
}

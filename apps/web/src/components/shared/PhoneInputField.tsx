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
    // Aligné avec Input: h-[48px], rounded-[8px], border 1px → 2px orange au focus
    <div className="relative z-50 flex items-center w-full h-[48px] rounded-[8px] border border-[var(--border-default)] bg-white overflow-hidden focus-within:border-2 focus-within:border-[var(--border-brand-primary)] transition-all duration-150">
      <CountryPicker
        value={country}
        onChange={onCountryChange}
        className="flex items-center gap-2 h-full pl-3 pr-2 bg-transparent whitespace-nowrap active:opacity-80 transition-colors shrink-0 outline-none text-[var(--color-text-primary)] font-medium font-poppins text-[14px]"
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
        className="flex-1 min-w-0 h-full bg-transparent outline-none px-3 text-[14px] font-medium font-poppins text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)] placeholder:font-normal"
      />
    </div>
  );
}

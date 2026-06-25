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
    <div className="relative z-50 flex items-center w-full h-[48px] rounded-[8px] border-[1.25px] border-[var(--border-primary)] bg-white overflow-hidden focus-within:border-[#FF7A00] transition-colors duration-200">
      <CountryPicker
        value={country}
        onChange={onCountryChange}
        className="flex items-center gap-[6px] h-full pl-[16px] pr-[8px] bg-transparent whitespace-nowrap active:opacity-80 transition-colors shrink-0 outline-none text-[var(--color-text-primary)] font-medium font-poppins text-[14px]"
      />
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
        className="flex-1 min-w-0 h-full bg-transparent outline-none pr-[16px] text-[14px] font-medium font-poppins text-[var(--color-text-primary)] placeholder:text-[#A3A3A3]"
      />
    </div>
  );
}

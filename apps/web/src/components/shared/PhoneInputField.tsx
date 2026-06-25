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
    <div className="relative z-50 flex items-center w-full h-[48px] rounded-[8px] border border-[#E5E5E5] bg-white overflow-hidden focus-within:border-[#FF7A00] transition-colors duration-200">
      <CountryPicker
        value={country}
        onChange={onCountryChange}
        className="flex items-center gap-[6px] h-full pl-[16px] pr-[8px] bg-transparent whitespace-nowrap active:opacity-80 transition-colors shrink-0 outline-none text-[var(--color-text-primary)] font-medium font-poppins text-[var(--font-size-body-medium)] leading-[20px] tracking-[-0.02em]"
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
        className="flex-1 min-w-0 h-full bg-transparent outline-none pr-[16px] text-[var(--font-size-body-medium)] leading-[20px] tracking-[-0.02em] font-medium font-poppins text-[var(--color-text-primary)] placeholder:text-[var(--color-text-placeholder)]"
      />
    </div>
  );
}

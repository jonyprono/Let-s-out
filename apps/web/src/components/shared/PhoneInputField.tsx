
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import { Country, COUNTRIES } from '@/lib/countries';

interface PhoneInputFieldProps {
  country: Country;
  onCountryChange: (country: Country) => void;
  phoneDisplay: string;
  onPhoneChange: (e: any) => void;
  onEnter?: () => void;
}

export function PhoneInputField({
  country,
  onCountryChange,
  phoneDisplay,
  onPhoneChange,
  onEnter
}: PhoneInputFieldProps) {
  
  const handleOnChange = (value: string, data: any) => {
    if (data && data.dialCode) {
      const newCountryCode = `+${data.dialCode}`;
      if (newCountryCode !== country.code) {
        const newCountry = COUNTRIES.find(c => c.code === newCountryCode);
        if (newCountry) {
          onCountryChange(newCountry);
        }
      }
      
      const rawPhone = value.slice(data.dialCode.length);
      onPhoneChange({ target: { value: rawPhone } });
    }
  };

  const dialCode = country.code.replace('+', '');
  const rawPhoneValue = phoneDisplay.replace(/\s+/g, '');
  const fullValue = `${dialCode}${rawPhoneValue}`;
  
  // Iso2 initial country (react-phone-input-2 uses lower case iso2)
  // We can guess the iso2 based on our existing country object if we map it,
  // but react-phone-input-2 automatically sets country based on fullValue.
  // We just provide 'bj' as default.
  
  return (
    <div className="custom-phone-wrapper relative flex items-center w-full h-[44px] rounded-[8px] border-[1.25px] border-[#E0E0E0] bg-white focus-within:border-action-primary focus-within:ring-1 focus-within:ring-action-primary transition-all duration-200">
      <PhoneInput
        country={'bj'}
        value={fullValue}
        onChange={handleOnChange}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onEnter) {
            onEnter();
          }
        }}
        placeholder="00 00 00 00 00"
        enableSearch={true}
        disableSearchIcon={true}
        searchPlaceholder="Rechercher..."
        preferredCountries={['bj', 'ci', 'tg', 'sn', 'cm', 'fr']}
        buttonClass="custom-phone-button"
        inputClass="custom-phone-input"
        dropdownClass="custom-phone-dropdown"
        containerClass="custom-phone-container"
      />
      
      {/* Absolute overlay elements to recreate Figma precisely */}
      <div className="custom-dial-code absolute left-[56px] pointer-events-none text-[#1B1818] text-[15px] font-poppins flex items-center h-full">
        ({dialCode})
      </div>
      <svg className="custom-chevron absolute pointer-events-none w-[16px] h-[16px] text-neutral-gray-500" style={{ left: 56 + dialCode.length * 9 + 10 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </div>
  );
}

/**
 * usePhoneFormatter
 * ─────────────────────────────────────────────────────────────
 * Formate l'affichage du numéro de téléphone en groupes de 2 chiffres
 * séparés par des espaces : ex. 0154333333 → "01 54 33 33 33"
 *
 * ▸ `displayValue`  : valeur affichée dans l'input (avec espaces)
 * ▸ `rawValue`      : chiffres bruts sans espaces (pour validation + API)
 * ▸ `handleChange`  : handler à passer à onChange de l'<input>
 * ▸ `reset`         : vide le champ (ex: quand on change de pays)
 *
 * Figma spec : Poppins Medium 14px / lh 20px / ls -2%
 */

import { useState, useCallback } from 'react'

function formatPhoneDisplay(raw: string): string {
  // Limite à 15 chiffres (max ITU-T E.164 sans l'indicatif)
  const digits = raw.replace(/\D/g, '').slice(0, 15)
  // Regroupe par paires : "01 54 33 33 33"
  return digits.replace(/(\d{2})(?=\d)/g, '$1 ').trimEnd()
}

export function usePhoneFormatter(initialRaw = '') {
  const [rawValue, setRawValue] = useState(initialRaw)

  const displayValue = formatPhoneDisplay(rawValue)

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      // Extrait les chiffres bruts depuis la valeur affichée
      const digits = e.target.value.replace(/\D/g, '').slice(0, 15)
      setRawValue(digits)
    },
    []
  )

  const reset = useCallback(() => setRawValue(''), [])

  return { displayValue, rawValue, handleChange, reset }
}

import { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { RefreshIcon } from 'hugeicons-react'
import { cn } from '@/lib/utils'

interface PrimaryButtonProps {
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  children: ReactNode
  /** Permet de changer la couleur ou d'ajouter des classes. La hauteur (h-[40px]),
   *  la largeur (w-full) et le rayon (rounded-full) sont TOUJOURS appliqués. */
  className?: string
  type?: 'button' | 'submit' | 'reset'
}

/**
 * Bouton principal réutilisable.
 * - Taille fixe : w-full h-[40px] rounded-full (identique au bouton "Se connecter")
 * - Couleur par défaut : orange #FF991C
 * - Passer une className pour surcharger uniquement la couleur/style.
 *   Exemple : <PrimaryButton className="bg-gray-200 text-gray-800">Annuler</PrimaryButton>
 */
export function PrimaryButton({
  onClick,
  disabled,
  loading,
  children,
  className,
  type = 'button',
}: PrimaryButtonProps) {
  return (
    <Button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        // ── Taille FIXE — ne jamais modifier ces classes ──
        'w-full px-[16px] py-[10px] rounded-[1000px]',
        // ── Style par défaut (orange) — surchargeables via className ──
        'bg-[#FF991C] hover:bg-[#FF7A00] text-white',
        // ── Typographie ──
        'font-roboto text-[14px] font-semibold leading-[20px]',
        // ── Comportement ──
        'flex items-center justify-center gap-2 transition-opacity disabled:opacity-50',
        className
      )}
    >
      {loading && (
        <RefreshIcon
          width={18}
          height={18}
          strokeWidth={1.4}
          className="animate-spin shrink-0"
        />
      )}
      <span className="break-words max-w-full flex items-center justify-center gap-2">{children}</span>
    </Button>
  )
}

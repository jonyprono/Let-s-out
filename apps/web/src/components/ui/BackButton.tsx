import { ArrowLeft02Icon } from 'hugeicons-react'
import { useNavigate } from 'react-router'
import React from 'react'

export interface BackButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void
  iconClassName?: string
}

export function BackButton({ onClick, className = '', iconClassName = '', ...props }: BackButtonProps) {
  const navigate = useNavigate()
  
  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) {
      onClick(e)
    } else {
      navigate(-1)
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center justify-center w-9 h-9 rounded-lg bg-transparent hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors active:scale-95 shrink-0 ${className}`}
      style={{ padding: '8px' }}
      aria-label="Retour"
      {...props}
    >
      <ArrowLeft02Icon 
        className={`w-5 h-5 text-[#A3A3A3] ${iconClassName}`} 
        strokeWidth={1.25} 
      />
    </button>
  )
}

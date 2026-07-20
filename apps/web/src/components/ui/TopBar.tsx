import React from 'react'
import { BackButton } from './BackButton'

interface TopBarProps {
  title?: React.ReactNode
  rightAction?: React.ReactNode
  onBack?: () => void
  className?: string
  hideBack?: boolean
  containerClassName?: string
}

export function TopBar({ title, rightAction, onBack, className = '', hideBack = false, containerClassName = '' }: TopBarProps) {
  return (
    <div className={`relative flex items-center justify-between px-4 py-3 min-h-[56px] w-full ${containerClassName}`}>
      {/* Absolute centered title to prevent shifting if right/left actions differ in width */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <h1 className={`text-lg font-semibold text-gray-900 dark:text-white truncate px-14 pointer-events-auto ${className}`}>
          {title}
        </h1>
      </div>
      
      <div className="relative z-10 flex items-center">
        {!hideBack && <BackButton onClick={onBack} />}
      </div>
      
      <div className="relative z-10 flex items-center gap-3">
        {rightAction}
      </div>
    </div>
  )
}

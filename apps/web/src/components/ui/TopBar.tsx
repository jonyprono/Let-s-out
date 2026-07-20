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
    <div className={`flex items-center justify-between px-4 py-3 min-h-[56px] w-full ${containerClassName}`}>
      <div className="flex items-center gap-3 overflow-hidden">
        {!hideBack && <BackButton onClick={onBack} />}
        {title && (
          <h1 className={`text-[17px] font-semibold text-gray-900 dark:text-white truncate ${className}`}>
            {title}
          </h1>
        )}
      </div>
      
      {rightAction && (
        <div className="flex items-center gap-2 flex-shrink-0 ml-2">
          {rightAction}
        </div>
      )}
    </div>
  )
}

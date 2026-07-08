import { useState, useEffect } from 'react'
import { motion } from 'motion/react'
import { Delete } from 'lucide-react'

interface PinPadProps {
  pin: string
  setPin: (pin: string) => void
  onComplete: (pin: string) => void
  maxLength?: number
  title?: string
  subtitle?: string
  error?: string | null
  isLoading?: boolean
  footer?: React.ReactNode
}

export function PinPad({
  pin,
  setPin,
  onComplete,
  maxLength = 5,
  title = 'Saisir le code PIN',
  subtitle = 'Entrez votre code de sécurité',
  error,
  isLoading,
  footer
}: PinPadProps) {
  const [shake, setShake] = useState(false)

  useEffect(() => {
    if (error) {
      setShake(true)
      const t = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(t)
    }
  }, [error])

  const handleNumber = (num: number) => {
    if (pin.length < maxLength) {
      const newPin = pin + num
      setPin(newPin)
      if (newPin.length === maxLength) {
        onComplete(newPin)
      }
    }
  }

  const handleDelete = () => {
    if (pin.length > 0) {
      setPin(pin.slice(0, -1))
    }
  }

  return (
    <div className="flex flex-col items-center w-full flex-1 pb-8">
      <div className="text-center mt-6 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
        <p className="text-gray-500 dark:text-gray-400 text-sm">{subtitle}</p>
      </div>

      <motion.div 
        animate={shake ? { x: [-10, 10, -10, 10, 0] } : {}}
        transition={{ duration: 0.4 }}
        className="flex gap-4 mb-12"
      >
        {Array.from({ length: maxLength }).map((_, i) => (
          <div 
            key={i} 
            className={`w-4 h-4 rounded-full transition-all duration-300 ${
              i < pin.length 
                ? 'bg-[#FFDF00] scale-110' 
                : 'bg-gray-200 dark:bg-gray-700'
            }`} 
          />
        ))}
      </motion.div>

      {error && (
        <p className="text-red-500 text-sm mb-6 -mt-6">{error}</p>
      )}

      <div className="grid grid-cols-3 gap-x-12 gap-y-6 w-full max-w-[280px]">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            disabled={isLoading}
            onClick={() => handleNumber(num)}
            className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
          >
            {num}
          </button>
        ))}
        <div /> {/* Empty space */}
        <button
          disabled={isLoading}
          onClick={() => handleNumber(0)}
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-medium text-gray-800 dark:text-white bg-gray-50 dark:bg-gray-800 active:bg-gray-200 dark:active:bg-gray-700 transition-colors"
        >
          0
        </button>
        <button
          disabled={isLoading || pin.length === 0}
          onClick={handleDelete}
          className="w-16 h-16 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-400 active:bg-gray-100 dark:active:bg-gray-800 transition-colors"
        >
          <Delete className="w-6 h-6" />
        </button>
      </div>

      {footer && (
        <div className="mt-auto pt-8 w-full text-center">
          {footer}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const onboardingScreens = [
  {
    id: 0,
    type: 'logo',
    image: '/logo.png',
  },
  {
    id: 1,
    title: 'Découvrez',
    description: 'Créez ou rejoignez des sorties, événements ou activités locales près de chez vous',
    image: '/splash1.png',
  },
  {
    id: 2,
    title: 'Partagez',
    description: 'Financez ensemble vos sorties en groupe via des cagnottes pour et partagez les frais pour mieux en profiter',
    image: '/splash2.png',
  },
  {
    id: 3,
    title: 'Socialisez',
    description: 'Faites de nouvelles rencontres inoubliables et de nouveaux amis autour d\'intérêts communs',
    image: '/splash3.png',
  },
]

interface SplashscreenProps {
  onComplete: () => void
}

export function Splashscreen({ onComplete }: SplashscreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [autoPlayDone, setAutoPlayDone] = useState(false)

  // Auto-advance from logo to first screen after 2.5s
  useEffect(() => {
    if (currentIndex === 0 && !autoPlayDone) {
      const timer = setTimeout(() => {
        setCurrentIndex(1)
        setAutoPlayDone(true)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, autoPlayDone])

  const handleNext = () => {
    if (currentIndex < onboardingScreens.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onComplete()
    }
  }

  const handlePrev = () => {
    if (currentIndex > 1) {
      setCurrentIndex(currentIndex - 1)
    }
  }

  const current = onboardingScreens[currentIndex]

  return (
    <div className="w-full h-full bg-[#F8F9FA] dark:bg-[#1A1A1A] flex flex-col relative overflow-hidden">


      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative z-10 -mt-8">
        <AnimatePresence mode="wait">
          {current.type === 'logo' ? (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex flex-col items-center w-full justify-center"
            >
              <img
                src={current.image}
                alt="Let's Out"
                className="w-full max-w-[300px] h-auto object-contain"
              />
            </motion.div>
          ) : (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="flex flex-col items-center w-full"
            >
              <div className="w-full h-[220px] mb-8 rounded-[32px] overflow-hidden shadow-sm">
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Dots */}
              <div className="flex items-center justify-center gap-1.5 mb-8">
                {onboardingScreens.slice(1).map((screen, index) => {
                  const isActive = currentIndex === index + 1
                  return (
                    <div
                      key={screen.id}
                      className={`h-1 rounded-full transition-colors ${isActive ? 'w-4 bg-[#FF9F1C]' : 'w-4 bg-gray-200'}`}
                    />
                  )
                })}
              </div>

              <h2 className="text-[24px] font-bold text-[#1A1A1A] dark:text-[#FFFFFF] dark:text-[#1A1A1A] mb-3">{current.title}</h2>
              <p className="text-[#666666] text-[14px] text-center max-w-[280px] leading-relaxed">
                {current.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      {currentIndex > 0 && (
        <div className="px-6 pb-10 z-10 flex items-center justify-center relative">
          <div className="flex gap-3 w-full max-w-[280px] justify-center">
            {currentIndex > 1 && (
              <button
                onClick={handlePrev}
                className="w-[60px] h-[52px] rounded-full bg-[#E5E7EB] flex items-center justify-center active:scale-[0.98] transition-transform shrink-0"
              >
                <ChevronLeft className="w-6 h-6 text-[#1A1A1A] dark:text-[#FFFFFF] dark:text-[#1A1A1A]" />
              </button>
            )}

            {currentIndex === 1 ? (
              <button
                onClick={handleNext}
                className="w-[120px] h-[52px] rounded-full bg-[#1A1A1A] dark:bg-[#FFFFFF] flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                <ChevronRight className="w-6 h-6 text-[#FFFFFF] dark:text-[#1A1A1A]" />
              </button>
            ) : currentIndex < onboardingScreens.length - 1 ? (
              <button
                onClick={handleNext}
                className="w-[120px] h-[52px] rounded-full bg-[#1A1A1A] dark:bg-[#FFFFFF] flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                <ChevronRight className="w-6 h-6 text-[#FFFFFF] dark:text-[#1A1A1A]" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 h-[52px] rounded-full bg-[#1A1A1A] dark:bg-[#FFFFFF] text-[#FFFFFF] dark:text-[#1A1A1A] font-bold text-[15px] flex items-center justify-center active:scale-[0.98] transition-transform"
              >
                Commencer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Home Indicator */}
      <div className="h-8 flex items-center justify-center absolute bottom-0 w-full pb-2">
        <div className="w-32 h-1 bg-black rounded-full" />
      </div>
    </div>
  )
}




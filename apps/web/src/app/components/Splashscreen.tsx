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
    description: 'Créez ou rejoignez des sorties, événements, ou activités locales près de chez vous',
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
    <div className="w-full h-full bg-background-default flex flex-col relative overflow-hidden">

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-200 relative z-10">
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
                className="w-full max-w-[260px] h-auto object-contain"
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
              {/* Image card with rounded corners */}
              <div className="w-full h-[220px] mb-300 rounded-[28px] overflow-hidden shadow-sm">
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Dots indicator */}
              <div className="flex items-center justify-center gap-100 mb-250">
                {onboardingScreens.slice(1).map((screen, index) => {
                  const isActive = currentIndex === index + 1
                  return (
                    <div
                      key={screen.id}
                      className={`h-[3px] rounded-full transition-all duration-300 ${isActive ? 'w-5 bg-action-primary' : 'w-5 bg-neutral-gray-300'}`}
                    />
                  )
                })}
              </div>

              <h2 className="text-[24px] font-bold text-[#1A1A1A] mb-150 text-center">{current.title}</h2>
              <p className="text-text-secondary text-[13px] text-center max-w-[260px] leading-relaxed">
                {current.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer Navigation */}
      {currentIndex > 0 && (
        <div className="px-200 pb-400 z-10 flex items-center justify-center relative">
          <div className="flex gap-150 w-full max-w-[300px] justify-center items-center">
            {currentIndex > 1 && (
              <button
                onClick={handlePrev}
                className="w-[52px] h-[52px] rounded-full bg-background-white border border-border-primary flex items-center justify-center active:scale-[0.96] transition-transform shrink-0 shadow-sm"
              >
                <ChevronLeft className="w-5 h-5 text-foreground" />
              </button>
            )}

            {currentIndex < onboardingScreens.length - 1 ? (
              <button
                onClick={handleNext}
                className="w-[52px] h-[52px] rounded-full bg-action-primary active:bg-action-primary-hover flex items-center justify-center active:scale-[0.96] transition-transform shadow-md"
              >
                <ChevronRight className="w-5 h-5 text-text-inverse" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex-1 h-[52px] rounded-full bg-action-primary active:bg-action-primary-hover text-text-inverse font-bold text-[15px] flex items-center justify-center active:scale-[0.98] transition-transform shadow-md"
              >
                Commencer
              </button>
            )}
          </div>
        </div>
      )}

      {/* Home Indicator */}
      <div className="h-6 flex items-center justify-center pb-1">
        <div className="w-32 h-[4px] bg-foreground rounded-full" />
      </div>
    </div>
  )
}

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Button } from '@/components/ui/button'
import { CarouselIndicators } from '@/components/ui/progress-bar'

/* ─────────────────────────────────────────────────────────────────
   Données des écrans onboarding
   Écran 0  → Logo + slogan (auto-advance 2.5s)
   Écrans 1-3 → Carrousel avec Stepper 3 barres
───────────────────────────────────────────────────────────────── */
const onboardingScreens = [
  { id: 0, type: 'logo' as const, image: '/logo.png' },
  {
    id: 1,
    type: 'slide' as const,
    title1: 'Partagez pour mieux',
    title2: 'profiter',
    description: 'Financez vos sorties en groupe via des cagnottes partagées et mutualisez les frais pour mieux en profiter ensemble',
    image: '/splash3.png',
  },
  {
    id: 2,
    type: 'slide' as const,
    title1: 'Rencontrez de',
    title2: 'nouveaux amis intéressants',
    description: "Faites de nouvelles rencontres inoubliables et de nouveaux amis autour d'intérêts communs",
    image: '/splash2.png',
  },
  {
    id: 3,
    type: 'slide' as const,
    title1: 'Découvrez des',
    title2: 'événements près de vous',
    description: 'Créez ou rejoignez des événements, sorties, ou activités intéressantes près de vous',
    image: '/splash1.png',
  },
]

const SLIDES = onboardingScreens.filter(s => s.type === 'slide')

interface SplashscreenProps {
  onComplete: () => void
}

export function Splashscreen({ onComplete }: SplashscreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [autoPlayDone, setAutoPlayDone] = useState(false)

  /* Auto-advance depuis le logo vers la slide 1 après 2.5s */
  useEffect(() => {
    if (currentIndex === 0 && !autoPlayDone) {
      const timer = setTimeout(() => {
        setCurrentIndex(1)
        setAutoPlayDone(true)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [currentIndex, autoPlayDone])

  const [touchStart, setTouchStart] = useState<number | null>(null)
  const [touchEnd, setTouchEnd] = useState<number | null>(null)

  // the required distance between touchStart and touchEnd to be detected as a swipe
  const minSwipeDistance = 50

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null) // otherwise the swipe is fired even with usual touch events
    setTouchStart(e.targetTouches[0].clientX)
  }

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX)
  }

  const onTouchEndHandler = () => {
    if (!touchStart || !touchEnd) return
    const distance = touchStart - touchEnd
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance

    if (isLeftSwipe) {
      // swipe left => next
      handleNext()
    } else if (isRightSwipe) {
      // swipe right => prev
      if (currentIndex > 1) {
        setCurrentIndex(currentIndex - 1)
      }
    }
  }

  const handleNext = () => {
    if (currentIndex < onboardingScreens.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else {
      onComplete()
    }
  }

  const current = onboardingScreens[currentIndex]

  return (
    <div
      className="w-full h-full flex flex-col flex-1 relative overflow-y-auto overflow-x-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      <div className="flex flex-col flex-1 px-6 pt-4 pb-3 justify-between w-full max-w-[390px] mx-auto">

      {/* ── En-tête (Passer) ──────────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="w-full max-w-[342px] mx-auto flex justify-end items-center h-[36px] shrink-0 z-20 relative">
          {currentIndex === 1 && (
            <button 
              onClick={onComplete} 
              className="flex items-center gap-1 font-poppins text-[14px] font-medium text-[#525252] focus:outline-none hover:opacity-75"
            >
              Passer <span className="text-[#A3A3A3] text-[12px] font-bold tracking-tighter">&gt;&gt;</span>
            </button>
          )}
        </div>
      )}

      <div 
        className="flex-1 flex flex-col items-center justify-center w-full relative z-10 pb-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEndHandler}
      >
        <AnimatePresence mode="wait">

          {/* ── ÉCRAN 0 : Logo centré sur fond blanc ──────────── */}
          {current.type === 'logo' && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center w-full"
            >
              {/* Logo Lets Out (image PNG avec icône + texte) */}
              <img
                src="/logo.png"
                alt="Let's Out"
                className="w-[220px] h-auto object-contain"
              />
            </motion.div>
          )}

          {/* ── ÉCRANS 1-3 : Carrousel ───────────────────────── */}
          {current.type === 'slide' && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.28, ease: 'easeOut' }}
              className="flex flex-col items-center w-full"
            >
              {/* Removed old Passer button */}

              {/* Wrapper shadow — centré avec dimension exacte */}
              <div
                className="w-full max-w-[342px] flex flex-col items-center gap-[32px] shrink-0"
              >
                <div
                  className=""
                  style={{
                    position: 'relative',
                    width: '100%',
                    maxWidth: '342px',
                    height: '142px',
                    borderRadius: '24px',
                    overflow: 'hidden',
                    isolation: 'isolate',
                    transform: 'translateZ(0) rotate(-1.73deg)', /* Inclinaison exacte Figma et GPU layer */
                    WebkitMaskImage: 'radial-gradient(white, white)', /* Fix overflow Safari */
                  }}
                >
                  <img
                    src={current.image}
                    alt={current.title1}
                    style={{
                      position: 'absolute',
                      inset: 0,
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                      objectPosition: current.id === 3 ? 'right center' : 'center',
                      display: 'block',
                    }}
                  />
                </div>

                <div className="flex flex-col items-center gap-[8px] w-full shrink-0">
                  {/* Titre fort */}
                  <h2 
                    className="font-poppins text-[20px] font-semibold text-center leading-[24px] w-full max-w-[271px]"
                    style={{
                      background: 'linear-gradient(243.43deg, #FFD439 16.67%, #FF7A00 83.33%)',
                      WebkitBackgroundClip: 'text',
                      WebkitTextFillColor: 'transparent',
                      backgroundClip: 'text',
                      color: 'transparent'
                    }}
                  >
                    <span className="block">{current.title1}</span>
                    <span className="block">{current.title2}</span>
                  </h2>
                  
                  {/* Description courte */}
                  <p className="font-inter text-[14px] font-normal leading-[20px] text-center text-[#404040] w-full max-w-[288px]">
                    {current.description}
                  </p>
                </div>
              </div>
              
              {/* Pagination Dots */}
              <div className="mt-8 mb-4">
                <CarouselIndicators count={SLIDES.length} activeIndex={currentIndex - 1} className="gap-[2px]" />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Navigation bas de page ──────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="flex flex-col justify-end shrink-0 w-full max-w-[342px] mx-auto pb-2 mt-auto">
          <Button
            onClick={handleNext}
            className="w-full h-[40px] bg-[#FF991C] hover:bg-[#e68a19] text-white font-poppins text-[14px] font-medium leading-[20px] rounded-full px-[14px] py-[10px]"
          >
            {currentIndex === onboardingScreens.length - 1 ? 'Commencer' : 'Suivant'}
          </Button>
        </div>
      )}

      </div>
    </div>
  )
}

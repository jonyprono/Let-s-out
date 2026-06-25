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
    title1: 'Découvrez des',
    title2: 'événements près de vous',
    description: 'Créez ou rejoignez des événements, sorties, ou activités intéressantes près de vous',
    image: '/splash1.png',
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
    title1: 'Partagez pour',
    title2: 'mieux profiter',
    description: 'Financez vos sorties en groupe via des cagnottes partagées et mutualisez les frais pour mieux en profiter ensemble',
    image: '/splash3.png',
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
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ backgroundColor: 'var(--background-white)' }}
    >

      {/* ── Contenu principal ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-[1rem] relative z-10">
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
              {/* Wrapper shadow — séparé du clip pour éviter le débordement */}
              {/* Passer > button for Slide 1 */}
              {current.id === 1 && (
                <div className="w-full flex justify-end mb-[2vh]">
                   <button onClick={onComplete} className="font-poppins text-[var(--font-size-body-medium)] text-[var(--color-text-secondary)] font-medium tracking-wide">Passer &gt;</button>
                </div>
              )}
              {current.id !== 1 && (
                <div className="w-full mb-[2vh] h-[20px]" />
              )}

              {/* Wrapper shadow — centré avec dimension exacte */}
              <div
                className="w-full flex justify-center mb-[4vh]"
                style={{
                  paddingLeft: '1.25rem',
                  paddingRight: '1.25rem',
                }}
              >
                <div
                  className="shadow-sm"
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
              </div>

              {/* Titre fort */}
              <h2 className="font-poppins text-[var(--font-size-title-large)] font-bold mb-3 text-center tracking-tight text-[var(--color-text-brand-primary)] leading-tight">
                <span className="block">{current.title1}</span>
                <span className="block">{current.title2}</span>
              </h2>
              {/* Description courte */}
              <p className="font-poppins text-[var(--font-size-body-medium)] font-medium leading-[var(--line-height-body-medium)] text-center text-[var(--color-text-secondary)] w-full max-w-[280px] mx-auto h-auto">
                {current.description}
              </p>
              
              {/* Pagination Dots */}
              <div className="mt-6 mb-2">
                <CarouselIndicators count={SLIDES.length} activeIndex={currentIndex - 1} />
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Navigation bas de page ──────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="px-[var(--spacing-200)] pb-[var(--spacing-300)] z-10 w-full max-w-[400px] mx-auto">
          <Button
            onClick={handleNext}
            size="lg"
            className="w-full rounded-full"
          >
            {currentIndex === onboardingScreens.length - 1 ? 'Commencer' : 'Suivant'}
          </Button>
        </div>
      )}

    </div>
  )
}

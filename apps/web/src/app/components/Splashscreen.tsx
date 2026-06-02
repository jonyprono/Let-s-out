import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavArrowRight } from 'iconoir-react'

/* ─────────────────────────────────────────────────────────────────
   Données des écrans onboarding
   Écran 0  → Logo + slogan (auto-advance 2.5s)
   Écrans 1-3 → Carrousel avec fondu enchaîné fluide
───────────────────────────────────────────────────────────────── */
const onboardingScreens = [
  { id: 0, type: 'logo' as const, image: '/logo.png' },
  {
    id: 1,
    type: 'slide' as const,
    title: 'Découvrez',
    description: 'Créez ou rejoignez des sorties, événements, ou activités locales près de chez vous',
    image: '/splash1.png',
  },
  {
    id: 2,
    type: 'slide' as const,
    title: 'Partagez',
    description: 'Financez ensemble vos sorties en groupe via des cagnottes et partagez les frais pour mieux en profiter',
    image: '/splash2.png',
  },
  {
    id: 3,
    type: 'slide' as const,
    title: 'Socialisez',
    description: "Faites de nouvelles rencontres inoubliables et de nouveaux amis autour d'intérêts communs",
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
  /* Index de la slide active pour le Stepper (0-based parmi les slides) */
  const activeSlide = currentIndex - 1
  const isLastSlide = currentIndex === onboardingScreens.length - 1

  return (
    <div
      className="w-full h-full flex flex-col relative overflow-hidden"
      style={{ backgroundColor: '#FFFFFF' }}
    >
      {/* ── Contenu principal ───────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center px-[1.5rem] relative z-10">
        <AnimatePresence mode="wait">

          {/* ── ÉCRAN 0 : Logo centré sur fond blanc ──────────── */}
          {current.type === 'logo' && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="flex flex-col items-center justify-center w-full"
            >
              <img
                src="/logo.png"
                alt="Lets Out"
                className="w-[220px] h-auto object-contain"
              />
            </motion.div>
          )}

          {/* ── ÉCRANS 1-3 : Fondu enchaîné fluide ───────────── */}
          {current.type === 'slide' && (
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="flex flex-col items-center w-full"
            >
              {/* Image format paysage avec bordures asymétriques */}
              <div
                className="w-full aspect-[2.2/1] overflow-hidden"
                style={{
                  borderRadius: '40px 40px 12px 40px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
                  transform: 'translateZ(0)',
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                }}
              >
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-full object-cover object-center"
                  style={{ borderRadius: '40px 40px 12px 40px' }}
                />
              </div>

              {/* ── Stepper : pilule orange + petits points gris ── */}
              <div className="flex items-center justify-center gap-[8px] my-[1.5rem] w-full">
                {SLIDES.map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: idx === activeSlide ? '28px' : '8px',
                      height: '8px',
                      backgroundColor: idx === activeSlide ? '#FF7A00' : '#E5E7EB',
                      transition: 'width 0.35s cubic-bezier(0.4, 0, 0.2, 1), background-color 0.35s ease',
                    }}
                  />
                ))}
              </div>

              {/* Titre */}
              <h2 className="text-[26px] font-bold text-foreground mb-[0.5rem] text-center leading-tight">
                {current.title}
              </h2>
              {/* Description */}
              <p className="splash-description max-w-[271px]">
                {current.description}
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Bouton centré en bas ─────────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="flex items-center justify-center pb-[2.5rem] z-10">
          <motion.button
            onClick={handleNext}
            aria-label={isLastSlide ? 'Commencer' : 'Suivant'}
            whileTap={{ scale: 0.95 }}
            animate={{ width: isLastSlide ? 160 : 56 }}
            transition={{ duration: 0.35, ease: 'easeInOut' }}
            className="h-[56px] rounded-[28px] bg-[#FF7A00] text-white font-semibold text-[15px] flex items-center justify-center shadow-lg overflow-hidden"
            style={{ minWidth: '56px' }}
          >
            <AnimatePresence mode="wait">
              {isLastSlide ? (
                <motion.span
                  key="commencer"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="whitespace-nowrap px-[20px]"
                >
                  Commencer
                </motion.span>
              ) : (
                <motion.span
                  key="arrow"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <NavArrowRight width={24} height={24} strokeWidth={2} className="text-white" />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </div>
      )}
    </div>
  )
}

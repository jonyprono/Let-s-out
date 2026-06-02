import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavArrowLeft, NavArrowRight } from 'iconoir-react'

/* ─────────────────────────────────────────────────────────────────
   Données des écrans onboarding
   Écran 0  → Logo + slogan (auto-advance 2.5s)
   Écrans 1-3 → Carrousel avec Stepper
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

  const handlePrev = () => {
    if (currentIndex > 1) setCurrentIndex(currentIndex - 1)
  }

  const current = onboardingScreens[currentIndex]
  /* Index de la slide active pour le Stepper (0-based parmi les slides) */
  const activeSlide = currentIndex - 1

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
              exit={{ opacity: 0, scale: 0.88 }}
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
              {/* Image format 16:9 avec coins uniformément arrondis */}
              <div
                className="w-full overflow-hidden"
                style={{
                  aspectRatio: '16 / 9',
                  borderRadius: '24px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.10)',
                  transform: 'translateZ(0)',
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)',
                }}
              >
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-full object-cover object-center"
                />
              </div>

              {/* ── Stepper : pilule orange active + petits points gris ── */}
              <div className="flex items-center justify-center gap-[8px] mt-[1.25rem] mb-[1.5rem] w-full">
                {SLIDES.map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: idx === activeSlide ? '28px' : '8px',
                      height: '8px',
                      backgroundColor: idx === activeSlide ? '#FF7A00' : '#E0E0E0',
                      transition: 'width 0.3s ease, background-color 0.3s ease',
                    }}
                  />
                ))}
              </div>

              {/* Titre */}
              <h2 className="text-[24px] font-bold text-foreground mb-[0.5rem] text-center leading-tight">
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

      {/* ── Navigation bas de page ──────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="px-[1.5rem] pb-[2rem] z-10">

          {/* ── SLIDE 1 : bouton suivant centré ── */}
          {currentIndex === 1 && (
            <div className="flex justify-center">
              <button
                onClick={handleNext}
                aria-label="Suivant"
                className="w-[52px] h-[52px] rounded-full bg-[#FF7A00] flex items-center justify-center active:scale-[0.95] transition-transform shadow-md"
              >
                <NavArrowRight width={22} height={22} strokeWidth={2} className="text-white" />
              </button>
            </div>
          )}

          {/* ── SLIDE 2 : retour gauche + suivant droite ── */}
          {currentIndex === 2 && (
            <div className="flex items-center justify-between">
              {/* Retour — cercle gris */}
              <button
                onClick={handlePrev}
                aria-label="Précédent"
                className="w-[52px] h-[52px] rounded-full bg-[#F0F0F0] flex items-center justify-center active:scale-[0.95] transition-transform"
              >
                <NavArrowLeft width={22} height={22} strokeWidth={2} className="text-foreground" />
              </button>
              {/* Suivant — cercle orange */}
              <button
                onClick={handleNext}
                aria-label="Suivant"
                className="w-[52px] h-[52px] rounded-full bg-[#FF7A00] flex items-center justify-center active:scale-[0.97] transition-transform shadow-md"
              >
                <NavArrowRight width={22} height={22} strokeWidth={2} className="text-white" />
              </button>
            </div>
          )}

          {/* ── SLIDE 3 (dernière) : retour cercle + Commencer pill ── */}
          {currentIndex === onboardingScreens.length - 1 && (
            <div className="flex items-center gap-[12px]">
              {/* Retour — cercle gris */}
              <button
                onClick={handlePrev}
                aria-label="Précédent"
                className="w-[52px] h-[52px] rounded-full bg-[#F0F0F0] flex items-center justify-center shrink-0 active:scale-[0.95] transition-transform"
              >
                <NavArrowLeft width={22} height={22} strokeWidth={2} className="text-foreground" />
              </button>
              {/* Commencer — pill orange pleine largeur */}
              <button
                onClick={handleNext}
                className="flex-1 h-[52px] rounded-[26px] bg-[#FF7A00] text-white font-semibold text-[15px] flex items-center justify-center active:scale-[0.97] transition-transform shadow-md"
              >
                Commencer
              </button>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

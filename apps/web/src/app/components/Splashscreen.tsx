import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavArrowLeft, NavArrowRight } from 'iconoir-react'

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
    title: 'Découvrez',
    description: 'Créez ou rejoignez des sorties, événements, ou activités locales près de chez vous',
    image: '/splash1.png',
    rotation: -4,
  },
  {
    id: 2,
    type: 'slide' as const,
    title: 'Partagez',
    description: 'Financez ensemble vos sorties en groupe via des cagnottes et partagez les frais pour mieux en profiter',
    image: '/splash2.png',
    rotation: 4,
  },
  {
    id: 3,
    type: 'slide' as const,
    title: 'Socialisez',
    description: "Faites de nouvelles rencontres inoubliables et de nouveaux amis autour d'intérêts communs",
    image: '/splash3.png',
    rotation: 0,
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
              {/* Image — format paysage, bords asymétriques, clip strict */}
              <div
                className="w-full h-[220px] mb-[1.5rem]"
                style={{
                  clipPath: 'inset(0 round 36px 36px 10px 36px)',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                }}
              >
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-full object-cover object-center"
                />
              </div>

              {/* ── Stepper : pilule orange active + petits cercles gris ── */}
              <div className="flex items-center justify-center gap-[8px] mb-[1.5rem]">
                {SLIDES.map((_, idx) => (
                  <div
                    key={idx}
                    className="rounded-full flex-shrink-0"
                    style={{
                      width: idx === activeSlide ? '28px' : '8px',
                      height: '8px',
                      backgroundColor: idx === activeSlide ? '#FF7A00' : '#E0E0E0',
                      transition: 'width 0.35s cubic-bezier(0.4,0,0.2,1), background-color 0.35s ease',
                    }}
                  />
                ))}
              </div>

              {/* Titre fort */}
              <h2 className="text-[26px] font-bold text-foreground mb-[0.5rem] text-center leading-tight">
                {current.title}
              </h2>
              {/* Description courte — Poppins Regular 12px / lh 18px / text-secondary */}
              <p className="splash-description max-w-[271px]">
                {current.description}
              </p>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Navigation bas de page ──────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="px-[1rem] pb-[2rem] z-10">

          {/* ── SLIDE 1 : bouton suivant centré ── */}
          {currentIndex === 1 && (
            <div className="flex justify-center">
              <button
                onClick={handleNext}
                aria-label="Suivant"
                className="h-[40px] px-[24px] rounded-[24px] bg-action-primary flex items-center justify-center gap-[8px] active:scale-[0.97] transition-transform"
              >
                <NavArrowRight width={20} height={20} strokeWidth={1.4} className="text-text-inverse" />
              </button>
            </div>
          )}

          {/* ── SLIDE 2 : retour gauche + suivant droite ── */}
          {currentIndex === 2 && (
            <div className="flex items-center justify-between">
              {/* Retour — pill gris clair */}
              <button
                onClick={handlePrev}
                aria-label="Précédent"
                className="h-[40px] px-[24px] rounded-[24px] bg-neutral-gray-100 flex items-center justify-center gap-[8px] active:scale-[0.95] transition-transform"
              >
                <NavArrowLeft width={20} height={20} strokeWidth={1.4} className="text-foreground" />
              </button>
              {/* Suivant — pill orange */}
              <button
                onClick={handleNext}
                aria-label="Suivant"
                className="h-[40px] px-[24px] rounded-[24px] bg-action-primary flex items-center justify-center gap-[8px] active:scale-[0.97] transition-transform"
              >
                <NavArrowRight width={20} height={20} strokeWidth={1.4} className="text-text-inverse" />
              </button>
            </div>
          )}

          {/* ── SLIDE 3 (dernière) : retour + Commencer flex-1 ── */}
          {currentIndex === onboardingScreens.length - 1 && (
            <div className="flex items-center gap-[8px]">
              {/* Retour — pill gris clair */}
              <button
                onClick={handlePrev}
                aria-label="Précédent"
                className="h-[40px] px-[24px] rounded-[24px] bg-neutral-gray-100 flex items-center justify-center gap-[8px] shrink-0 active:scale-[0.95] transition-transform"
              >
                <NavArrowLeft width={20} height={20} strokeWidth={1.4} className="text-foreground" />
              </button>
              {/* Commencer — pill orange pleine largeur */}
              <button
                onClick={handleNext}
                className="flex-1 h-[40px] rounded-[24px] bg-action-primary text-text-inverse font-semibold text-[15px] flex items-center justify-center active:scale-[0.97] transition-transform"
              >
                Commencer
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Home Indicator iOS ──────────────────────────────────── */}
      <div className="h-[22px] flex items-center justify-center pb-[4px]">
        <div className="w-[128px] h-[4px] bg-foreground rounded-full opacity-20" />
      </div>
    </div>
  )
}

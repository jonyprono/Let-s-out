import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavArrowLeft, NavArrowRight } from 'iconoir-react'

/* ─────────────────────────────────────────────────────────────────
   Données des écrans onboarding
   Écran 0  → Logo + slogan (auto-advance 2.5s)
   Écrans 1-3 → Carrousel avec Stepper 3 barres
───────────────────────────────────────────────────────────────── */
const onboardingScreens = [
  { id: 0, type: 'logo' as const,    image: '/logo.png' },
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
    description: 'Faites de nouvelles rencontres inoubliables et de nouveaux amis autour d\'intérêts communs',
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
      style={{ backgroundColor: '#FFFFFF' }}
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
              {/* Image avec format paysage (environ 21:9) et bordures asymétriques */}
              <div
                className="w-full aspect-[2.2/1] overflow-hidden mb-[2rem]"
                style={{
                  borderRadius: '40px 40px 12px 40px',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.08)',
                  transform: 'translateZ(0)', // Force Safari clipping
                  WebkitMaskImage: '-webkit-radial-gradient(white, black)' // Ultimate Safari overflow fix
                }}
              >
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-full h-full object-cover object-center"
                  style={{ borderRadius: '40px 40px 12px 40px' }} // Fallback for robust clipping
                />
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

      {/* ── Navigation bas de page (Footer partagé : Stepper + Boutons) ── */}
      {currentIndex > 0 && (
        <div className="relative flex items-center justify-center w-full px-[1.5rem] pb-[2.5rem] mt-auto z-10 h-[50px]">
          
          {/* Bouton Précédent (gauche) */}
          {currentIndex > 1 && (
            <button
              onClick={handlePrev}
              aria-label="Précédent"
              className="absolute left-[1.5rem] w-[40px] h-[40px] rounded-full bg-neutral-gray-100 flex items-center justify-center active:scale-[0.95] transition-transform"
            >
              <NavArrowLeft width={20} height={20} strokeWidth={1.8} className="text-foreground" />
            </button>
          )}

          {/* Stepper (Pagination centrée) */}
          <div className="flex items-center justify-center gap-[8px]">
            {SLIDES.map((_, idx) => (
              <div
                key={idx}
                className="rounded-full transition-all duration-300 flex-shrink-0"
                style={{
                  width: idx === activeSlide ? '28px' : '8px',
                  height: '8px',
                  backgroundColor: idx === activeSlide ? '#FF7A00' : '#E5E7EB',
                }}
              />
            ))}
          </div>

          {/* Bouton Suivant / Commencer (droite absolue) */}
          <div className="absolute right-[1.5rem]">
            {currentIndex < onboardingScreens.length - 1 ? (
              <button
                onClick={handleNext}
                aria-label="Suivant"
                className="w-[44px] h-[44px] rounded-full bg-[#FF7A00] flex items-center justify-center active:scale-[0.97] transition-transform shadow-md"
              >
                <NavArrowRight width={24} height={24} strokeWidth={2} className="text-white" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="h-[44px] px-[24px] rounded-[22px] bg-[#FF7A00] text-white font-semibold text-[15px] flex items-center justify-center active:scale-[0.97] transition-transform shadow-md"
              >
                Commencer
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Home Indicator iOS ──────────────────────────────────── */}
      <div className="h-[22px] flex items-center justify-center pb-[4px]">
        <div className="w-[128px] h-[4px] bg-foreground rounded-full opacity-20" />
      </div>
    </div>
  )
}

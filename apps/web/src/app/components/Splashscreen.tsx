import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'

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
              {/* Wrapper shadow — séparé du clip pour éviter le débordement */}
              {/* Passer > button for Slide 1 */}
              {current.id === 1 && (
                <div className="w-full flex justify-end mb-[2vh]">
                   <button onClick={onComplete} className="text-[13px] text-gray-500 font-medium tracking-wide">Passer &gt;</button>
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
              <h2 className="text-[20px] sm:text-[22px] font-bold mb-3 text-center tracking-tight font-sans">
                <span className="text-[#FF8A00] block">{current.title1}</span>
                <span className="text-[#FFB800] block">{current.title2}</span>
              </h2>
              {/* Description courte — accessible, text-center */}
              <p className="font-['Inter_Display',sans-serif] text-[13px] sm:text-[14px] font-medium leading-[20px] sm:leading-[22px] text-center text-gray-500 dark:text-gray-400 w-full max-w-[280px] mx-auto h-auto">
                {current.description}
              </p>
              
              {/* Decorative Dash */}
              <div className="w-[20px] h-[3px] bg-[#FF8A00] mx-auto rounded-full mt-6 mb-2" />
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ── Navigation bas de page ──────────────────────────────── */}
      {currentIndex > 0 && (
        <div className="px-[1rem] pb-[1rem] sm:pb-[1.5rem] z-10 w-full max-w-[400px] mx-auto">
          <button
            onClick={handleNext}
            className="w-full h-[48px] rounded-[24px] bg-[#F58220] hover:bg-[#E6781D] text-white font-semibold text-[16px] flex items-center justify-center active:scale-[0.97] transition-transform"
          >
            {currentIndex === onboardingScreens.length - 1 ? 'Commencer' : 'Suivant'}
          </button>
        </div>
      )}

    </div>
  )
}

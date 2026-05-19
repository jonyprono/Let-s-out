import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const onboardingScreens = [
  {
    id: 0,
    type: 'logo',
    title: "Let's Out",
    subtitle: 'Connect & Enjoy',
  },
  {
    id: 1,
    title: 'Découvrez',
    description: 'Créez ou rejoignez des sorties, événements et activités locales près de chez vous.',
    image: 'https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=400&h=300&fit=crop',
  },
  {
    id: 2,
    title: 'Partagez',
    description: 'Financez ensemble vos sorties en groupe via des cagnottes.',
    image: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?w=400&h=300&fit=crop',
  },
  {
    id: 3,
    title: 'Socialisez',
    description: 'Faites de nouvelles rencontres et créez des liens autour d\'intérêts communs.',
    image: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?w=400&h=300&fit=crop',
  },
];

interface SplashscreenProps {
  onComplete: () => void;
}

export function Splashscreen({ onComplete }: SplashscreenProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [autoPlayDone, setAutoPlayDone] = useState(false);

  useEffect(() => {
    if (currentIndex === 0 && !autoPlayDone) {
      const timer = setTimeout(() => {
        setCurrentIndex(1);
        setAutoPlayDone(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [currentIndex, autoPlayDone]);

  const handleNext = () => {
    if (currentIndex < onboardingScreens.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onComplete();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 1) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const current = onboardingScreens[currentIndex];

  return (
    <div className="w-full h-full bg-white flex flex-col">
      {/* Status Bar */}
      <div className="h-11 flex items-center justify-between px-6">
        <span className="text-sm">9:41</span>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-black rounded-sm" />
          <div className="w-4 h-3 bg-black rounded-sm" />
          <div className="w-4 h-3 bg-black rounded-sm" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <AnimatePresence mode="wait">
          {current.type === 'logo' ? (
            <motion.div
              key="logo"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex flex-col items-center"
            >
              <div className="mb-6">
                <svg width="120" height="120" viewBox="0 0 120 120" fill="none">
                  <path d="M60 110L45 85L30 95L35 70L15 60L35 50L30 25L45 35L60 10L75 35L90 25L85 50L105 60L85 70L90 95L75 85L60 110Z" fill="#9747FF"/>
                  <circle cx="45" cy="45" r="8" fill="#FF9F1C"/>
                  <circle cx="75" cy="45" r="8" fill="#FF9F1C"/>
                  <circle cx="60" cy="70" r="8" fill="#FF9F1C"/>
                  <circle cx="35" cy="70" r="6" fill="#00D4FF"/>
                  <circle cx="85" cy="70" r="6" fill="#00D4FF"/>
                </svg>
              </div>
              <h1 className="text-5xl mb-2">
                <span className="text-[#FF9F1C]">Let's</span>{' '}
                <span className="text-[#9747FF]">Out</span>
              </h1>
              <p className="text-gray-600">Connect & Enjoy</p>
            </motion.div>
          ) : (
            <motion.div
              key={current.id}
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex flex-col items-center text-center"
            >
              <div className="mb-8 rounded-3xl overflow-hidden">
                <img
                  src={current.image}
                  alt={current.title}
                  className="w-80 h-56 object-cover"
                />
              </div>
              <h2 className="text-2xl mb-4">{current.title}</h2>
              <p className="text-gray-600 text-sm max-w-xs leading-relaxed">
                {current.description}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Navigation */}
      {currentIndex > 0 && (
        <div className="px-6 pb-8">
          <div className="flex items-center justify-between mb-6">
            {currentIndex > 1 ? (
              <button
                onClick={handlePrev}
                className="flex items-center gap-2 text-gray-600"
              >
                <ChevronLeft className="w-5 h-5" />
                <span>Précédent</span>
              </button>
            ) : (
              <div />
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-2 bg-[#FF9F1C] text-white px-8 py-3 rounded-full"
            >
              <span>{currentIndex === onboardingScreens.length - 1 ? 'Commencer' : 'Suivant'}</span>
              {currentIndex < onboardingScreens.length - 1 && <ChevronRight className="w-5 h-5" />}
            </button>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center justify-center gap-2">
            {onboardingScreens.slice(1).map((screen, index) => (
              <div
                key={screen.id}
                className={`h-1 rounded-full transition-all ${
                  currentIndex === index + 1
                    ? 'w-8 bg-[#9747FF]'
                    : 'w-1 bg-gray-300'
                }`}
              />
            ))}
          </div>
        </div>
      )}

      {/* Home Indicator */}
      <div className="h-8 flex items-center justify-center pb-2">
        <div className="w-32 h-1 bg-black rounded-full" />
      </div>
    </div>
  );
}

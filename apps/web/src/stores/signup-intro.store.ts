import { create } from 'zustand'
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware'

/**
 * Réponses du parcours d'accueil (avant l'inscription) : prénom, nom,
 * date de naissance, genre. Conservées si l'utilisateur fait « Retour » ou
 * recharge la page ; vidées après une inscription réussie (reset()).
 *
 * Stockage protégé par try/catch : navigation privée, stockage bloqué ou
 * WebView restreinte → le parcours fonctionne quand même (en mémoire).
 */

export type SignupGender = 'FEMALE' | 'MALE' | 'OTHER'

/** Inscription Google en attente de finalisation (/auth/google/complete). */
export interface PendingGoogleSignup {
  signupToken: string
  email: string
}

interface SignupIntroState {
  firstName: string
  lastName: string
  /** "AAAA-MM-JJ" — jamais celle d'un mineur (effacée par markUnderage) */
  birthDate: string | null
  gender: SignupGender | null
  google: PendingGoogleSignup | null

  setName: (firstName: string, lastName: string) => void
  setBirthDate: (birthDate: string | null) => void
  setGender: (gender: SignupGender) => void
  setGoogle: (google: PendingGoogleSignup | null, prefill?: { firstName?: string; lastName?: string }) => void
  /** Âge insuffisant : efface la date et pose le flag de blocage de session. */
  markUnderage: () => void
  /** Après inscription réussie (ou abandon volontaire) : tout effacer. */
  reset: () => void
}

const STORE_KEY = 'letsout-signup-intro'
const UNDERAGE_FLAG_KEY = 'letsout-signup-underage'

function safeStorage(getStorage: () => Storage): StateStorage {
  return {
    getItem: (name) => {
      try { return getStorage().getItem(name) } catch { return null }
    },
    setItem: (name, value) => {
      try { getStorage().setItem(name, value) } catch { /* stockage indisponible */ }
    },
    removeItem: (name) => {
      try { getStorage().removeItem(name) } catch { /* stockage indisponible */ }
    },
  }
}

const sessionStore = safeStorage(() => window.sessionStorage)

// Repli en mémoire si sessionStorage est indisponible (le flag tient alors jusqu'au rechargement)
let underageInMemory = false

/** Vrai si un âge insuffisant a été saisi pendant cette session. */
export function isSignupBlockedForSession(): boolean {
  return underageInMemory || sessionStore.getItem(UNDERAGE_FLAG_KEY) === '1'
}

const emptyAnswers = {
  firstName: '',
  lastName: '',
  birthDate: null,
  gender: null,
  google: null,
} satisfies Pick<SignupIntroState, 'firstName' | 'lastName' | 'birthDate' | 'gender' | 'google'>

export const useSignupIntroStore = create<SignupIntroState>()(
  persist(
    (set) => ({
      ...emptyAnswers,
      setName: (firstName, lastName) => set({ firstName, lastName }),
      setBirthDate: (birthDate) => set({ birthDate }),
      setGender: (gender) => set({ gender }),
      setGoogle: (google, prefill) =>
        set((s) => ({
          google,
          // Préremplir depuis Google sans écraser ce que l'utilisateur a déjà saisi
          firstName: s.firstName || prefill?.firstName || '',
          lastName: s.lastName || prefill?.lastName || '',
        })),
      markUnderage: () => {
        underageInMemory = true
        sessionStore.setItem(UNDERAGE_FLAG_KEY, '1')
        // La date d'un mineur n'est jamais conservée, ni le reste des réponses
        set({ ...emptyAnswers })
      },
      reset: () => set({ ...emptyAnswers }),
    }),
    {
      name: STORE_KEY,
      version: 1,
      storage: createJSONStorage(() => safeStorage(() => window.localStorage)),
      partialize: (s) => ({
        firstName: s.firstName,
        lastName: s.lastName,
        birthDate: s.birthDate,
        gender: s.gender,
        google: s.google,
      }),
    },
  ),
)

/** Les 3 réponses du parcours d'accueil sont-elles toutes présentes ? */
export function hasCompletedSignupIntro(s: Pick<SignupIntroState, 'firstName' | 'lastName' | 'birthDate' | 'gender'>): boolean {
  return !!(s.firstName && s.lastName && s.birthDate && s.gender)
}

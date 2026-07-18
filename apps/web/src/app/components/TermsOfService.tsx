import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

export function TermsOfService() {
  const navigate = useNavigate()

  return (
    <div className="w-full h-[100dvh] flex flex-col bg-[#F5F5F5] dark:bg-[#111111] font-inter">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-[#1A1A1A] px-5 pt-[max(env(safe-area-inset-top),1rem)] pb-4 flex items-center gap-3 sticky top-0 z-10 border-b border-gray-100 dark:border-[#2A2A2A] flex-shrink-0">
        <button
          onClick={() => window.history.state && window.history.state.idx > 0 ? navigate(-1) : navigate('/settings')}
          className="w-9 h-9 bg-[#F5F5F5] dark:bg-[#2A2A2A] rounded-full flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-800 dark:text-gray-200" strokeWidth={2.5} />
        </button>
        <h1 className="text-[20px] font-bold font-poppins text-gray-900 dark:text-white leading-tight">
          Conditions d'utilisation
        </h1>
      </div>
      
      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        <div className="max-w-[760px] mx-auto bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 md:p-8 shadow-sm">
          
          <div className="mb-8">
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <strong className="text-gray-700 dark:text-gray-300">Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR')}
            </p>
          </div>
          
          <div className="text-[14px] text-gray-600 dark:text-gray-300 leading-relaxed mb-8">
            <p>
              Bienvenue sur Let's Out ! Les présentes conditions régissent votre utilisation de notre application
              et de nos services.
            </p>
          </div>

          <Section title="1. Acceptation des conditions">
            <p>
              En créant un compte sur Let's Out (notamment via l'authentification par SMS), vous acceptez d'être
              lié par ces conditions.
            </p>
          </Section>

          <Section title="2. Utilisation du service">
            <p>
              Let's Out permet de créer, partager et participer à des événements locaux. Vous vous engagez à
              utiliser le service de manière légale et respectueuse. Tout contenu abusif, discriminatoire ou illégal
              entraînera la suspension de votre compte.
            </p>
          </Section>

          <Section title="3. Contenu utilisateur">
            <p>
              Vous restez propriétaire du contenu que vous publiez sur l'application, mais vous nous accordez une licence
              non-exclusive pour l'afficher et le partager dans le cadre du fonctionnement de l'application.
            </p>
          </Section>

          <Section title="4. Responsabilité">
            <p>
              Let's Out agit en tant qu'intermédiaire technologique. Nous ne sommes pas responsables du déroulement des
              événements organisés via la plateforme, qui relèvent de la responsabilité de leurs organisateurs.
            </p>
          </Section>

          <div className="mt-10 pt-6 border-t border-gray-100 dark:border-[#2A2A2A] text-[13px] flex items-center justify-center gap-3">
            <Link to="/" className="text-[#FF7A00] font-medium hover:underline">← Retour à l'accueil</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to="/privacy" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Politique de confidentialité</Link>
          </div>

        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 last:mb-0">
      <h2 className="text-[17px] font-bold font-poppins text-gray-900 dark:text-white mb-3 border-l-4 border-[#FF7A00] pl-3">
        {title}
      </h2>
      <div className="text-[14px] text-gray-600 dark:text-gray-300 leading-relaxed">
        {children}
      </div>
    </div>
  )
}

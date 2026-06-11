import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

export function TermsOfService() {
  const navigate = useNavigate()

  return (
    <div className="h-[100dvh] overflow-y-auto bg-background-white p-5 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Conditions d'utilisation</h1>
      </div>
      
      <div className="prose prose-sm text-gray-700 space-y-4">
        <p><strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR')}</p>
        
        <p>
          Bienvenue sur Let's Out ! Les présentes conditions régissent votre utilisation de notre application
          et de nos services.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">1. Acceptation des conditions</h2>
        <p>
          En créant un compte sur Let's Out (notamment via l'authentification par SMS), vous acceptez d'être
          lié par ces conditions.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">2. Utilisation du service</h2>
        <p>
          Let's Out permet de créer, partager et participer à des événements locaux. Vous vous engagez à
          utiliser le service de manière légale et respectueuse. Tout contenu abusif, discriminatoire ou illégal
          entraînera la suspension de votre compte.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">3. Contenu utilisateur</h2>
        <p>
          Vous restez propriétaire du contenu que vous publiez sur l'application, mais vous nous accordez une licence
          non-exclusive pour l'afficher et le partager dans le cadre du fonctionnement de l'application.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">4. Responsabilité</h2>
        <p>
          Let's Out agit en tant qu'intermédiaire technologique. Nous ne sommes pas responsables du déroulement des
          événements organisés via la plateforme, qui relèvent de la responsabilité de leurs organisateurs.
        </p>
      </div>
    </div>
  )
}

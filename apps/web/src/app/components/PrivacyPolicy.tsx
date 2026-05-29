import { ArrowLeft } from 'lucide-react'
import { useNavigate } from 'react-router'

export function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background-white p-5 pb-10">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Règles de confidentialité</h1>
      </div>
      
      <div className="prose prose-sm text-gray-700 space-y-4">
        <p><strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR')}</p>
        
        <p>
          Chez Let's Out, nous prenons votre vie privée très au sérieux. Cette politique de confidentialité
          décrit comment nous collectons, utilisons et protégeons vos informations personnelles.
        </p>
        
        <h2 className="text-lg font-semibold text-black mt-6 mb-2">1. Informations collectées</h2>
        <p>
          Nous collectons votre numéro de téléphone (utilisé pour l'authentification OTP via Firebase)
          ainsi que les données de profil (nom, pseudo, photo) que vous nous fournissez.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">2. Utilisation des données</h2>
        <p>
          Vos données sont exclusivement utilisées pour le bon fonctionnement de l'application (création
          et participation aux événements, messagerie, notifications) et ne sont jamais vendues à des tiers.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">3. Sécurité</h2>
        <p>
          Toutes les données sont stockées de manière sécurisée. Nous utilisons Firebase pour l'authentification
          qui garantit des standards de sécurité élevés.
        </p>

        <h2 className="text-lg font-semibold text-black mt-6 mb-2">4. Vos droits</h2>
        <p>
          Vous pouvez à tout moment demander la suppression de votre compte et de vos données en nous
          contactant via l'application.
        </p>
      </div>
    </div>
  )
}

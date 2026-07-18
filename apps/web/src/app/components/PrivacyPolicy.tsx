import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

export function PrivacyPolicy() {
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
          Politique de confidentialité
        </h1>
      </div>

      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        <div className="max-w-[760px] mx-auto bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 md:p-8 shadow-sm">
          <div className="mb-8">
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <strong className="text-gray-700 dark:text-gray-300">Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}<br />
              <strong className="text-gray-700 dark:text-gray-300">Application :</strong> Let's Out<br />
              <strong className="text-gray-700 dark:text-gray-300">Éditeur :</strong> Let's Out (Project ID: let-s-out)
            </p>
          </div>

          <Section title="1. Présentation de l'application">
            <p>
              <strong>Let's Out</strong> est une application mobile sociale qui permet aux utilisateurs de créer,
              découvrir et rejoindre des événements et activités locales. L'application facilite les rencontres
              entre personnes partageant des centres d'intérêt communs, et propose un système de cagnotte partagée
              pour financer les sorties en groupe.
            </p>
            <p className="mt-3">
              L'application est disponible sur iOS et Android et accessible via le web à l'adresse de notre domaine officiel.
            </p>
          </Section>

          <Section title="2. Responsable du traitement">
            <p>
              Le responsable du traitement des données personnelles est l'éditeur de l'application <strong>Let's Out</strong>.
              Pour toute question relative à la protection de vos données, vous pouvez nous contacter à :
              <a href="mailto:contact@letsout.app" className="text-[#FF7A00] font-medium ml-1 hover:underline">contact@letsout.app</a>
            </p>
          </Section>

          <Section title="3. Données collectées">
            <p className="mb-3">Nous collectons les données suivantes :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-900 dark:text-white">Numéro de téléphone</strong> — utilisé pour l'authentification OTP via Firebase Authentication. Aucun mot de passe n'est stocké.</li>
              <li><strong className="text-gray-900 dark:text-white">Données de profil</strong> — nom d'affichage, nom d'utilisateur (pseudo), photo de profil que vous choisissez de fournir.</li>
              <li><strong className="text-gray-900 dark:text-white">Données d'événements</strong> — événements que vous créez ou auxquels vous participez, date, lieu, description.</li>
              <li><strong className="text-gray-900 dark:text-white">Messages</strong> — contenu des conversations dans la messagerie intégrée à l'application.</li>
              <li><strong className="text-gray-900 dark:text-white">Données de paiement</strong> — informations de transaction pour les cagnottes et participations à des événements payants (traitées via des prestataires sécurisés, non stockées directement par Let's Out).</li>
              <li><strong className="text-gray-900 dark:text-white">Données techniques</strong> — identifiant d'appareil, système d'exploitation, logs d'erreurs pour améliorer la stabilité de l'application.</li>
            </ul>
          </Section>

          <Section title="4. Utilisation des données">
            <p className="mb-3">Vos données sont utilisées exclusivement pour :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Vous authentifier de manière sécurisée via OTP (code à usage unique)</li>
              <li>Afficher votre profil public aux autres utilisateurs</li>
              <li>Vous permettre de créer et rejoindre des événements</li>
              <li>Vous permettre d'envoyer et recevoir des messages</li>
              <li>Vous envoyer des notifications relatives à vos événements et messages</li>
              <li>Améliorer les fonctionnalités et la stabilité de l'application</li>
            </ul>
            <p className="mt-4">
              <strong className="text-gray-900 dark:text-white">Vos données ne sont jamais vendues à des tiers.</strong> Elles ne sont pas utilisées
              à des fins publicitaires ni pour entraîner des modèles d'intelligence artificielle.
            </p>
          </Section>

          <Section title="5. Authentification OTP et Google / Firebase">
            <p>
              Let's Out utilise <strong className="text-gray-900 dark:text-white">Firebase Authentication</strong> (service de Google) pour gérer
              l'authentification par numéro de téléphone. Un code OTP (One-Time Password) est envoyé par SMS
              pour vérifier votre identité. Firebase opère selon la politique de confidentialité de Google :
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#FF7A00] font-medium ml-1 hover:underline">policies.google.com/privacy</a>.
            </p>
            <p className="mt-3">
              Nous utilisons également <strong className="text-gray-900 dark:text-white">Google Sign-In</strong> en option pour faciliter la connexion.
              Lorsque vous choisissez ce mode de connexion, nous accédons uniquement à votre nom, adresse e-mail
              et photo de profil Google. Ces données sont utilisées uniquement pour créer ou identifier votre
              compte Let's Out et ne sont pas partagées avec des tiers.
            </p>
          </Section>

          <Section title="6. Partage des données">
            <p className="mb-3">Vos données peuvent être partagées avec :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-900 dark:text-white">Firebase / Google</strong> — pour l'authentification et le stockage sécurisé</li>
              <li><strong className="text-gray-900 dark:text-white">Cloudinary</strong> — pour le stockage des photos et médias uploadés</li>
              <li><strong className="text-gray-900 dark:text-white">Prestataires de paiement</strong> — pour le traitement sécurisé des transactions</li>
            </ul>
            <p className="mt-4">Ces prestataires sont soumis à leurs propres politiques de confidentialité et disposent de mesures de sécurité appropriées.</p>
          </Section>

          <Section title="7. Durée de conservation">
            <p>
              Vos données sont conservées tant que votre compte est actif. Lors de la suppression de votre compte,
              toutes vos données personnelles sont supprimées dans un délai de 30 jours, à l'exception des données
              conservées à des fins légales (ex. : historique de transactions).
            </p>
          </Section>

          <Section title="8. Sécurité">
            <p className="mb-3">
              Let's Out met en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Authentification sans mot de passe (OTP uniquement)</li>
              <li>Communications chiffrées via HTTPS/TLS</li>
              <li>Accès aux données restreint aux seuls employés et services nécessaires</li>
              <li>Stockage sécurisé via l'infrastructure Firebase (Google Cloud)</li>
            </ul>
          </Section>

          <Section title="9. Vos droits (RGPD)">
            <p className="mb-3">Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-900 dark:text-white">Droit d'accès</strong> — consulter les données que nous détenons sur vous</li>
              <li><strong className="text-gray-900 dark:text-white">Droit de rectification</strong> — corriger des données inexactes</li>
              <li><strong className="text-gray-900 dark:text-white">Droit à l'effacement</strong> — demander la suppression de votre compte et de vos données</li>
              <li><strong className="text-gray-900 dark:text-white">Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
              <li><strong className="text-gray-900 dark:text-white">Droit d'opposition</strong> — vous opposer à certains traitements</li>
            </ul>
            <p className="mt-4">Pour exercer ces droits, contactez-nous à <a href="mailto:contact@letsout.app" className="text-[#FF7A00] font-medium ml-1 hover:underline">contact@letsout.app</a>.</p>
          </Section>

          <Section title="10. Cookies et technologies similaires">
            <p>
              L'application mobile Let's Out n'utilise pas de cookies publicitaires. Des données de session
              (tokens d'authentification) sont stockées localement sur votre appareil pour maintenir votre
              connexion et peuvent être effacées en déconnectant votre compte ou en réinitialisant l'application.
            </p>
          </Section>

          <Section title="11. Modifications de la politique">
            <p>
              Nous pouvons mettre à jour cette politique de confidentialité à tout moment. Vous serez informé
              des modifications importantes via l'application. Nous vous encourageons à consulter régulièrement
              cette page pour rester informé.
            </p>
          </Section>

          <Section title="12. Contact">
            <p>
              Pour toute question relative à la confidentialité ou pour exercer vos droits, contactez-nous :<br />
              <span className="inline-flex items-center gap-2 mt-2">
                📧 <a href="mailto:contact@letsout.app" className="text-[#FF7A00] font-medium hover:underline">contact@letsout.app</a>
              </span>
            </p>
          </Section>

          <div className="mt-10 pt-6 border-t border-gray-100 dark:border-[#2A2A2A] text-[13px] flex items-center justify-center gap-3">
            <Link to="/" className="text-[#FF7A00] font-medium hover:underline">← Retour à l'accueil</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Conditions d'utilisation</Link>
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

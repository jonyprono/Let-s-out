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
          <div className="mb-8 border-b border-gray-100 dark:border-[#2A2A2A] pb-5">
            <h2 className="text-[14px] font-bold uppercase tracking-wider text-[#FF7A00] mb-2 font-poppins">
              Partie II — Politique de confidentialité
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <strong className="text-gray-700 dark:text-gray-300">Version :</strong> MVP 1.0 (août 2026)<br />
              <strong className="text-gray-700 dark:text-gray-300">Éditeur :</strong> FIHODECORP SARL (Cotonou, République du Bénin)<br />
              <strong className="text-gray-700 dark:text-gray-300">Application :</strong> Let's Out
            </p>
          </div>

          <Section title="Article 11 — Responsable du traitement">
            <p>
              Le responsable du traitement des données personnelles collectées via l'application Let's Out est FIHODECORP SARL, domiciliée à Cotonou, République du Bénin. Contact :{' '}
              <a href="mailto:fihodecorp@gmail.com" className="text-[#FF7A00] font-medium hover:underline">
                fihodecorp@gmail.com
              </a>.
            </p>
          </Section>

          <Section title="Article 12 — Données collectées">
            <SubSection title="12.1 Données fournies par l'utilisateur">
              <p>
                Lors de la création d'un compte et de l'utilisation de l'application, FIHODECORP SARL collecte les données suivantes :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Nom et prénom.</li>
                <li>Adresse email.</li>
                <li>Numéro de téléphone mobile.</li>
                <li>Photo de profil (optionnelle).</li>
                <li>Centres d'intérêt sélectionnés lors de l'onboarding.</li>
                <li>Informations de paiement transmises via l'agrégateur FedaPay (FIHODECORP SARL ne stocke pas les données bancaires brutes).</li>
              </ul>
            </SubSection>

            <SubSection title="12.2 Données collectées automatiquement">
              <p>
                L'application collecte automatiquement certaines données techniques lors de son utilisation :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Données de connexion (adresse IP, type d'appareil, système d'exploitation, version de l'application).</li>
                <li>Données de géolocalisation, uniquement si l'utilisateur a accordé cette autorisation, et uniquement pour afficher les événements à proximité.</li>
                <li>Données de navigation au sein de l'application (pages visitées, actions effectuées).</li>
                <li>Historique des événements créés et rejoints.</li>
              </ul>
            </SubSection>

            <SubSection title="12.3 Données relatives aux cagnottes">
              <p>
                Dans le cadre du système de cagnotte, FIHODECORP SARL collecte et conserve les données relatives aux transactions effectuées par les utilisateurs (montant contribué, date, identifiant de la transaction). Ces données sont conservées pendant une durée de 5 ans conformément aux obligations légales en matière comptable et fiscale.
              </p>
            </SubSection>
          </Section>

          <Section title="Article 13 — Finalités du traitement">
            <p>
              Les données personnelles collectées par FIHODECORP SARL sont utilisées aux fins suivantes :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Création et gestion des comptes utilisateurs.</li>
              <li>Fourniture des fonctionnalités de l'application (événements, cagnottes, chat, notation).</li>
              <li>Personnalisation de l'expérience utilisateur (suggestions d'événements selon les centres d'intérêt).</li>
              <li>Gestion des paiements et des cagnottes via FedaPay.</li>
              <li>Envoi de notifications push relatives à l'activité de l'utilisateur sur l'application.</li>
              <li>Amélioration et optimisation de l'application.</li>
              <li>Prévention de la fraude et sécurisation de la plateforme.</li>
              <li>Respect des obligations légales et réglementaires applicables.</li>
            </ul>
          </Section>

          <Section title="Article 14 — Partage des données">
            <p>
              FIHODECORP SARL ne vend pas les données personnelles de ses utilisateurs à des tiers. Les données peuvent être partagées dans les cas suivants :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Avec FedaPay, agrégateur de paiement, dans le cadre strict du traitement des transactions financières.</li>
              <li>Avec les prestataires techniques assurant l'hébergement et la maintenance de l'application, dans le cadre de contrats garantissant la confidentialité des données.</li>
              <li>Avec les autorités compétentes, en cas d'obligation légale ou de réquisition judiciaire.</li>
              <li>Avec un futur partenaire financier agréé BCEAO, dans le cadre du partenariat de séquestre, avec information préalable des utilisateurs.</li>
            </ul>
          </Section>

          <Section title="Article 15 — Durée de conservation des données">
            <p>
              Les données personnelles des utilisateurs sont conservées pendant toute la durée d'activité de leur compte. En cas de suppression du compte, les données sont supprimées dans un délai de 30 jours, à l'exception des données financières liées aux cagnottes qui sont conservées pendant 5 ans conformément aux obligations légales.
            </p>
          </Section>

          <Section title="Article 16 — Droits des utilisateurs">
            <p>
              Conformément aux principes généraux de protection des données personnelles et aux textes applicables, l'utilisateur dispose des droits suivants :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong className="text-gray-800 dark:text-gray-200">Droit d'accès :</strong> l'utilisateur peut demander à consulter l'ensemble des données personnelles le concernant détenues par FIHODECORP SARL.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Droit de rectification :</strong> l'utilisateur peut demander la correction de données inexactes ou incomplètes.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Droit à l'effacement :</strong> l'utilisateur peut demander la suppression de ses données personnelles, sous réserve des obligations légales de conservation.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Droit à la portabilité :</strong> l'utilisateur peut demander à recevoir ses données dans un format structuré et couramment utilisé.</li>
              <li><strong className="text-gray-800 dark:text-gray-200">Droit d'opposition :</strong> l'utilisateur peut s'opposer au traitement de ses données à des fins de prospection commerciale.</li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, l'utilisateur peut contacter FIHODECORP SARL à l'adresse :{' '}
              <a href="mailto:fihodecorp@gmail.com" className="text-[#FF7A00] font-medium hover:underline">
                fihodecorp@gmail.com
              </a>. FIHODECORP SARL s'engage à répondre à toute demande dans un délai de 30 jours.
            </p>
          </Section>

          <Section title="Article 17 — Sécurité des données">
            <p>
              FIHODECORP SARL met en oeuvre les mesures techniques et organisationnelles appropriées pour protéger les données personnelles des utilisateurs contre tout accès non autorisé, perte, destruction ou divulgation. Les données de paiement sont traitées exclusivement par FedaPay, prestataire certifié, et ne sont jamais stockées en clair sur les serveurs de FIHODECORP SARL.
            </p>
            <p>
              En cas de violation de données susceptible d'engendrer un risque pour les droits et libertés des utilisateurs, FIHODECORP SARL s'engage à en informer les utilisateurs concernés dans les meilleurs délais.
            </p>
          </Section>

          <Section title="Article 18 — Cookies et traceurs">
            <p>
              L'application mobile Let's Out peut utiliser des identifiants techniques (équivalents aux cookies) pour assurer son bon fonctionnement et améliorer l'expérience utilisateur. Ces identifiants ne sont pas utilisés à des fins publicitaires dans le cadre de la version MVP. L'utilisateur peut désactiver certains traceurs depuis les paramètres de son appareil mobile.
            </p>
          </Section>

          <Section title="Article 19 — Géolocalisation">
            <p>
              L'application peut accéder à la localisation de l'utilisateur uniquement si celui-ci a accordé cette autorisation explicitement depuis les paramètres de son appareil. La géolocalisation est utilisée uniquement pour afficher les événements proches de l'utilisateur. Elle n'est jamais utilisée pour suivre les déplacements de l'utilisateur en dehors de l'application. L'utilisateur peut révoquer cette autorisation à tout moment depuis les paramètres de son appareil.
            </p>
          </Section>

          <Section title="Article 20 — Modifications de la politique de confidentialité">
            <p>
              FIHODECORP SARL se réserve le droit de modifier la présente politique de confidentialité à tout moment. Les modifications sont publiées dans l'application et prennent effet immédiatement. L'utilisateur sera informé de toute modification substantielle par notification. La poursuite de l'utilisation de l'application vaut acceptation de la politique de confidentialité mise à jour.
            </p>
          </Section>

          <Section title="Article 21 — Contact et réclamations">
            <p>
              Pour toute question, réclamation ou exercice de vos droits relatifs à vos données personnelles, vous pouvez contacter FIHODECORP SARL :
            </p>
            <div className="mt-3 p-4 bg-[#F9F9F9] dark:bg-[#222222] rounded-xl border border-gray-100 dark:border-[#2A2A2A] text-[13px] space-y-1.5">
              <p><strong className="text-gray-800 dark:text-gray-200">Par email :</strong> <a href="mailto:fihodecorp@gmail.com" className="text-[#FF7A00] font-medium hover:underline">fihodecorp@gmail.com</a></p>
              <p><strong className="text-gray-800 dark:text-gray-200">Par téléphone :</strong> <a href="tel:0166652313" className="text-[#FF7A00] font-medium hover:underline">01 66 65 23 13</a></p>
              <p><strong className="text-gray-800 dark:text-gray-200">Par courrier :</strong> FIHODECORP SARL, Cotonou, République du Bénin</p>
            </div>
          </Section>

          <div className="mt-10 pt-6 border-t border-gray-100 dark:border-[#2A2A2A] text-[13px] flex items-center justify-center gap-3">
            <Link to="/" className="text-[#FF7A00] font-medium hover:underline">← Retour à l'accueil</Link>
            <span className="text-gray-300 dark:text-gray-600">•</span>
            <Link to="/terms" className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors">Conditions Générales d'Utilisation</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8 last:mb-0">
      <h2 className="text-[17px] font-bold font-poppins text-gray-900 dark:text-white mb-4 border-l-4 border-[#FF7A00] pl-3">
        {title}
      </h2>
      <div className="text-[14px] text-gray-600 dark:text-gray-300 leading-relaxed space-y-3">
        {children}
      </div>
    </div>
  )
}

function SubSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4 mb-4 first:mt-0 last:mb-0">
      <h3 className="text-[15px] font-semibold font-poppins text-gray-800 dark:text-gray-200 mb-2">
        {title}
      </h3>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  )
}


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
          Conditions Générales d'Utilisation
        </h1>
      </div>
      
      {/* ── Scrollable content ─────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 pt-6 pb-12">
        <div className="max-w-[760px] mx-auto bg-white dark:bg-[#1A1A1A] rounded-2xl p-6 md:p-8 shadow-sm">
          
          <div className="mb-8 border-b border-gray-100 dark:border-[#2A2A2A] pb-5">
            <h2 className="text-[14px] font-bold uppercase tracking-wider text-[#FF7A00] mb-2 font-poppins">
              Partie I — Conditions Générales d'Utilisation (CGU)
            </h2>
            <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
              <strong className="text-gray-700 dark:text-gray-300">Version :</strong> MVP 1.0 (août 2026)<br />
              <strong className="text-gray-700 dark:text-gray-300">Éditeur :</strong> FIHODECORP SARL (Cotonou, République du Bénin)<br />
              <strong className="text-gray-700 dark:text-gray-300">Application :</strong> Let's Out
            </p>
          </div>

          <Section title="Article 1 — Présentation de l'application">
            <p>
              Let's Out est une application mobile sociale éditée par FIHODECORP SARL, Société à Responsabilité Limitée de droit béninois, dont le siège social est établi à Cotonou, République du Bénin. L'application permet à ses utilisateurs de créer et de rejoindre des événements collectifs locaux (sorties, concerts, voyages, activités sportives ou culturelles) et de participer à des cagnottes collectives pour cofinancer les dépenses liées à ces événements.
            </p>
            <p>
              L'utilisation de l'application implique l'acceptation pleine et entière des présentes Conditions Générales d'Utilisation (CGU). Toute personne qui accède à l'application et qui crée un compte utilisateur est réputée avoir lu, compris et accepté l'intégralité des présentes CGU.
            </p>
          </Section>

          <Section title="Article 2 — Accès à l'application">
            <SubSection title="2.1 Conditions d'accès">
              <p>
                L'application Let's Out est accessible à toute personne physique âgée de 18 ans révolus. Les personnes mineures ne sont pas autorisées à créer un compte ou à utiliser les fonctionnalités de l'application, notamment celles liées aux paiements et aux cagnottes.
              </p>
              <p>
                L'utilisateur s'engage à fournir des informations exactes, complètes et à jour lors de la création de son compte. FIHODECORP SARL se réserve le droit de suspendre ou de supprimer tout compte dont les informations seraient inexactes ou frauduleuses.
              </p>
            </SubSection>

            <SubSection title="2.2 Création du compte">
              <p>
                La création d'un compte est obligatoire pour accéder aux fonctionnalités de l'application. L'utilisateur s'engage à choisir un mot de passe suffisamment sécurisé et à ne pas le communiquer à des tiers. L'utilisateur est seul responsable de l'utilisation de son compte et de toute action effectuée depuis celui-ci.
              </p>
              <p>
                En cas de perte ou de vol de ses identifiants, l'utilisateur doit en informer immédiatement FIHODECORP SARL à l'adresse suivante :{' '}
                <a href="mailto:fihodecorp@gmail.com" className="text-[#FF7A00] font-medium hover:underline">
                  fihodecorp@gmail.com
                </a>.
              </p>
            </SubSection>
          </Section>

          <Section title="Article 3 — Fonctionnalités de l'application">
            <SubSection title="3.1 Création et participation à des événements">
              <p>
                L'application permet à tout utilisateur inscrit de créer un événement collectif (soirée, excursion, activité sportive, repas, etc.) et de le partager avec d'autres utilisateurs ou avec des tiers via un lien ou un code unique généré par l'application.
              </p>
              <p>
                L'organisateur d'un événement est responsable de l'exactitude des informations qu'il publie (date, lieu, description, nombre de places disponibles). FIHODECORP SARL ne peut être tenu responsable des annulations, modifications ou incidents liés à un événement organisé par un utilisateur tiers.
              </p>
            </SubSection>

            <SubSection title="3.2 Système de cagnotte">
              <p>
                Let's Out propose un système de cagnotte collective permettant aux participants d'un événement de cofinancer les dépenses associées (transport, restauration, entrées, hébergement, etc.).
              </p>
              <p>
                Dans le cadre de la version MVP, les fonds collectés via la cagnotte sont conservés par FIHODECORP SARL sur un compte bancaire dédié et séparé de ses fonds propres opérationnels. Ces fonds ne peuvent être décaissés que selon les règles de validation définies dans l'application et décrites ci-après. FIHODECORP SARL agit en qualité de tiers de confiance temporaire, dans l'attente de la mise en place d'un partenariat avec un établissement financier agréé par la BCEAO.
              </p>
              <p className="font-semibold text-gray-800 dark:text-gray-200 mt-3">
                Les règles de décaissement sont les suivantes :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Toute dépense doit être soumise par l'organisateur de l'événement avec un justificatif.</li>
                <li>Le décaissement est conditionné à la validation par un seuil minimum de participants défini lors de la création de l'événement.</li>
                <li>Chaque participant peut consulter en temps réel l'état de la cagnotte, les contributions reçues et les dépenses effectuées.</li>
                <li>En cas d'annulation de l'événement, les fonds collectés sont remboursés intégralement aux participants dans un délai maximum de 7 jours ouvrés.</li>
                <li>FIHODECORP SARL prélève une commission de service sur chaque cagnotte traitée. Le montant de cette commission est affiché clairement avant toute contribution.</li>
                <li>FIHODECORP SARL s'engage à ne jamais utiliser les fonds des cagnottes à des fins autres que celles prévues pour l'événement concerné.</li>
              </ul>
            </SubSection>

            <SubSection title="3.3 Système de notation et de fiabilité">
              <p>
                À l'issue de chaque événement, les participants sont invités à se noter mutuellement selon trois critères : ponctualité, attitude et fiabilité. Ce système de notation est destiné à renforcer la confiance au sein de la communauté Let's Out.
              </p>
              <p>
                L'utilisateur accepte que sa note globale soit visible sur son profil public. Toute tentative de manipulation du système de notation (fausses notes, notes entre comptes liés, etc.) entraîne la suspension immédiate du compte concerné.
              </p>
            </SubSection>

            <SubSection title="3.4 Confirmation de présence via QR code">
              <p>
                Chaque événement dispose d'un QR code unique généré par l'application. Les participants sont tenus de scanner ce code à leur arrivée pour confirmer leur présence. L'absence de scan dans le délai prévu est enregistrée comme une absence non justifiée et peut impacter le score de fiabilité de l'utilisateur.
              </p>
            </SubSection>
          </Section>

          <Section title="Article 4 — Obligations et responsabilités de l'utilisateur">
            <SubSection title="4.1 Comportement général">
              <p>
                L'utilisateur s'engage à utiliser l'application de manière conforme aux lois et règlements en vigueur en République du Bénin, aux présentes CGU, et aux bonnes pratiques communautaires. Il s'engage notamment à :
              </p>
              <ul className="list-disc pl-5 space-y-2">
                <li>Ne pas publier de contenu illicite, offensant, diffamatoire ou portant atteinte aux droits de tiers.</li>
                <li>Ne pas usurper l'identité d'un autre utilisateur ou d'une tierce personne.</li>
                <li>Ne pas utiliser l'application à des fins commerciales non autorisées par FIHODECORP SARL.</li>
                <li>Ne pas tenter de pirater, de déstabiliser ou d'altérer le fonctionnement de l'application.</li>
                <li>Respecter les autres membres de la communauté Let's Out lors des événements et sur la plateforme.</li>
              </ul>
            </SubSection>

            <SubSection title="4.2 Responsabilité de l'organisateur">
              <p>
                L'utilisateur qui crée un événement assume l'entière responsabilité de son organisation, de sa conformité avec la loi béninoise, et de la sécurité des participants. FIHODECORP SARL ne peut être tenu responsable d'un incident survenu lors d'un événement organisé par un utilisateur tiers.
              </p>
              <p>
                L'organisateur s'engage à ne pas utiliser les fonds de la cagnotte à des fins autres que celles déclarées lors de la création de l'événement. Tout détournement de fonds est susceptible de donner lieu à des poursuites judiciaires.
              </p>
            </SubSection>

            <SubSection title="4.3 No-show et absence non justifiée">
              <p>
                L'utilisateur qui s'inscrit à un événement et ne se présente pas sans avoir prévenu au moins 2 heures avant le début de l'événement s'expose à une pénalité sur son score de fiabilité. En cas de contribution à la cagnotte, le remboursement d'un no-show est soumis à la politique d'annulation définie lors de la création de l'événement.
              </p>
            </SubSection>
          </Section>

          <Section title="Article 5 — Responsabilité de FIHODECORP SARL">
            <p>
              FIHODECORP SARL s'engage à fournir un service de qualité et à assurer la disponibilité de l'application dans la mesure du possible. Cependant, FIHODECORP SARL ne peut garantir une disponibilité ininterrompue et se réserve le droit d'effectuer des opérations de maintenance susceptibles d'interrompre temporairement l'accès à l'application.
            </p>
            <p className="font-semibold text-gray-800 dark:text-gray-200 mt-3">
              FIHODECORP SARL ne peut être tenu responsable :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Des dommages directs ou indirects résultant de l'utilisation ou de l'impossibilité d'utiliser l'application.</li>
              <li>Des contenus publiés par les utilisateurs sur la plateforme.</li>
              <li>Des incidents survenus lors des événements organisés par les utilisateurs.</li>
              <li>Des pertes financières résultant d'une mauvaise utilisation du système de cagnotte par un utilisateur.</li>
              <li>Des interruptions de service liées à des problèmes techniques indépendants de la volonté de FIHODECORP SARL (panne de réseau, force majeure, etc.).</li>
            </ul>
          </Section>

          <Section title="Article 6 — Propriété intellectuelle">
            <p>
              L'application Let's Out, son code source, son design, sa charte graphique, ses fonctionnalités, son nom commercial et l'ensemble de ses contenus sont la propriété exclusive de FIHODECORP SARL. Toute reproduction, représentation, modification, distribution ou exploitation de ces éléments sans autorisation écrite préalable de FIHODECORP SARL est strictly interdite et constitue une contrefaçon sanctionnée par la loi.
            </p>
            <p>
              L'utilisateur concède à FIHODECORP SARL une licence non exclusive, mondiale et gratuite pour reproduire et afficher les contenus qu'il publie sur la plateforme (photos de profil, descriptions d'événements, avis), dans le cadre du fonctionnement normal de l'application.
            </p>
          </Section>

          <Section title="Article 7 — Suspension et résiliation du compte">
            <p>
              FIHODECORP SARL se réserve le droit de suspendre ou de supprimer le compte d'un utilisateur sans préavis en cas de :
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Violation des présentes CGU.</li>
              <li>Comportement frauduleux ou abusif.</li>
              <li>Signalement répété par d'autres utilisateurs.</li>
              <li>Tentative de manipulation du système de notation ou de la cagnotte.</li>
              <li>Non-paiement d'une somme due à FIHODECORP SARL.</li>
            </ul>
            <p className="mt-3">
              L'utilisateur peut à tout moment supprimer son compte depuis les paramètres de l'application. La suppression du compte entraîne la perte de l'ensemble des données associées, sous réserve des obligations légales de conservation.
            </p>
          </Section>

          <Section title="Article 8 — Modification des CGU">
            <p>
              FIHODECORP SARL se réserve le droit de modifier les présentes CGU à tout moment. Les modifications entrent en vigueur dès leur publication dans l'application. L'utilisateur sera notifié de toute modification substantielle via une notification push ou un email. La poursuite de l'utilisation de l'application après notification vaut acceptation des nouvelles CGU.
            </p>
          </Section>

          <Section title="Article 9 — Droit applicable et règlement des litiges">
            <p>
              Les présentes CGU sont régies par le droit de la République du Bénin et les actes uniformes de l'OHADA applicables. En cas de litige entre l'utilisateur et FIHODECORP SARL, les parties s'efforceront de trouver une solution amiable dans un délai de 30 jours. À défaut d'accord amiable, le litige sera soumis aux juridictions compétentes du Bénin.
            </p>
          </Section>

          <Section title="Article 10 — Contact">
            <p>
              Pour toute question relative aux présentes CGU, l'utilisateur peut contacter FIHODECORP SARL :
            </p>
            <div className="mt-3 p-4 bg-[#F9F9F9] dark:bg-[#222222] rounded-xl border border-gray-100 dark:border-[#2A2A2A] text-[13px] space-y-1.5">
              <p><strong className="text-gray-800 dark:text-gray-200">Société :</strong> FIHODECORP SARL</p>
              <p><strong className="text-gray-800 dark:text-gray-200">Email :</strong> <a href="mailto:fihodecorp@gmail.com" className="text-[#FF7A00] font-medium hover:underline">fihodecorp@gmail.com</a></p>
              <p><strong className="text-gray-800 dark:text-gray-200">Téléphone :</strong> <a href="tel:0166652313" className="text-[#FF7A00] font-medium hover:underline">01 66 65 23 13</a></p>
            </div>
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


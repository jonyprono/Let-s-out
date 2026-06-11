import { ArrowLeft } from 'lucide-react'
import { Link, useNavigate } from 'react-router'

export function PrivacyPolicy() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", backgroundColor: '#fff', minHeight: '100vh' }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.75rem',
        padding: '1rem 1.25rem', borderBottom: '1px solid #f0f0f0',
        position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 10
      }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft style={{ width: 22, height: 22, color: '#1a1a1a' }} />
        </button>
        <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#1a1a1a' }}>
          Politique de confidentialité
        </h1>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '2rem 1.25rem 4rem' }}>
        <p style={{ color: '#888', fontSize: '0.85rem', marginBottom: '2rem' }}>
          <strong>Dernière mise à jour :</strong> {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}<br />
          Application : <strong>Let's Out</strong><br />
          Éditeur : Let's Out (Project ID: let-s-out)
        </p>

        <Section title="1. Présentation de l'application">
          <p>
            <strong>Let's Out</strong> est une application mobile sociale qui permet aux utilisateurs de créer,
            découvrir et rejoindre des événements et activités locales. L'application facilite les rencontres
            entre personnes partageant des centres d'intérêt communs, et propose un système de cagnotte partagée
            pour financer les sorties en groupe.
          </p>
          <p>
            L'application est disponible sur iOS et Android et accessible via le web à l'adresse de notre domaine officiel.
          </p>
        </Section>

        <Section title="2. Responsable du traitement">
          <p>
            Le responsable du traitement des données personnelles est l'éditeur de l'application <strong>Let's Out</strong>.
            Pour toute question relative à la protection de vos données, vous pouvez nous contacter à :
            <a href="mailto:contact@letsout.app" style={{ color: '#F58220', textDecoration: 'none' }}> contact@letsout.app</a>
          </p>
        </Section>

        <Section title="3. Données collectées">
          <p>Nous collectons les données suivantes :</p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li><strong>Numéro de téléphone</strong> — utilisé pour l'authentification OTP via Firebase Authentication. Aucun mot de passe n'est stocké.</li>
            <li><strong>Données de profil</strong> — nom d'affichage, nom d'utilisateur (pseudo), photo de profil que vous choisissez de fournir.</li>
            <li><strong>Données d'événements</strong> — événements que vous créez ou auxquels vous participez, date, lieu, description.</li>
            <li><strong>Messages</strong> — contenu des conversations dans la messagerie intégrée à l'application.</li>
            <li><strong>Données de paiement</strong> — informations de transaction pour les cagnottes et participations à des événements payants (traitées via des prestataires sécurisés, non stockées directement par Let's Out).</li>
            <li><strong>Données techniques</strong> — identifiant d'appareil, système d'exploitation, logs d'erreurs pour améliorer la stabilité de l'application.</li>
          </ul>
        </Section>

        <Section title="4. Utilisation des données">
          <p>Vos données sont utilisées exclusivement pour :</p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Vous authentifier de manière sécurisée via OTP (code à usage unique)</li>
            <li>Afficher votre profil public aux autres utilisateurs</li>
            <li>Vous permettre de créer et rejoindre des événements</li>
            <li>Vous permettre d'envoyer et recevoir des messages</li>
            <li>Vous envoyer des notifications relatives à vos événements et messages</li>
            <li>Améliorer les fonctionnalités et la stabilité de l'application</li>
          </ul>
          <p style={{ marginTop: '0.75rem' }}>
            <strong>Vos données ne sont jamais vendues à des tiers.</strong> Elles ne sont pas utilisées
            à des fins publicitaires ni pour entraîner des modèles d'intelligence artificielle.
          </p>
        </Section>

        <Section title="5. Authentification OTP et Google / Firebase">
          <p>
            Let's Out utilise <strong>Firebase Authentication</strong> (service de Google) pour gérer
            l'authentification par numéro de téléphone. Un code OTP (One-Time Password) est envoyé par SMS
            pour vérifier votre identité. Firebase opère selon la politique de confidentialité de Google :
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#F58220', textDecoration: 'none' }}> policies.google.com/privacy</a>.
          </p>
          <p>
            Nous utilisons également <strong>Google Sign-In</strong> en option pour faciliter la connexion.
            Lorsque vous choisissez ce mode de connexion, nous accédons uniquement à votre nom, adresse e-mail
            et photo de profil Google. Ces données sont utilisées uniquement pour créer ou identifier votre
            compte Let's Out et ne sont pas partagées avec des tiers.
          </p>
        </Section>

        <Section title="6. Partage des données">
          <p>Vos données peuvent être partagées avec :</p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li><strong>Firebase / Google</strong> — pour l'authentification et le stockage sécurisé</li>
            <li><strong>Cloudinary</strong> — pour le stockage des photos et médias uploadés</li>
            <li><strong>Prestataires de paiement</strong> — pour le traitement sécurisé des transactions</li>
          </ul>
          <p>Ces prestataires sont soumis à leurs propres politiques de confidentialité et disposent de mesures de sécurité appropriées.</p>
        </Section>

        <Section title="7. Durée de conservation">
          <p>
            Vos données sont conservées tant que votre compte est actif. Lors de la suppression de votre compte,
            toutes vos données personnelles sont supprimées dans un délai de 30 jours, à l'exception des données
            conservées à des fins légales (ex. : historique de transactions).
          </p>
        </Section>

        <Section title="8. Sécurité">
          <p>
            Let's Out met en œuvre des mesures de sécurité techniques et organisationnelles pour protéger vos données :
          </p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li>Authentification sans mot de passe (OTP uniquement)</li>
            <li>Communications chiffrées via HTTPS/TLS</li>
            <li>Accès aux données restreint aux seuls employés et services nécessaires</li>
            <li>Stockage sécurisé via l'infrastructure Firebase (Google Cloud)</li>
          </ul>
        </Section>

        <Section title="9. Vos droits (RGPD)">
          <p>Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :</p>
          <ul style={{ paddingLeft: '1.25rem', lineHeight: 2 }}>
            <li><strong>Droit d'accès</strong> — consulter les données que nous détenons sur vous</li>
            <li><strong>Droit de rectification</strong> — corriger des données inexactes</li>
            <li><strong>Droit à l'effacement</strong> — demander la suppression de votre compte et de vos données</li>
            <li><strong>Droit à la portabilité</strong> — recevoir vos données dans un format structuré</li>
            <li><strong>Droit d'opposition</strong> — vous opposer à certains traitements</li>
          </ul>
          <p>Pour exercer ces droits, contactez-nous à <a href="mailto:contact@letsout.app" style={{ color: '#F58220', textDecoration: 'none' }}>contact@letsout.app</a>.</p>
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
            📧 <a href="mailto:contact@letsout.app" style={{ color: '#F58220', textDecoration: 'none' }}>contact@letsout.app</a>
          </p>
        </Section>

        <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #f0f0f0', fontSize: '0.8rem', color: '#aaa' }}>
          <Link to="/" style={{ color: '#F58220', textDecoration: 'none' }}>← Retour à l'accueil</Link>
          {' · '}
          <Link to="/terms" style={{ color: '#aaa', textDecoration: 'none' }}>Conditions d'utilisation</Link>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '2rem' }}>
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#1a1a1a', marginBottom: '0.6rem', borderLeft: '3px solid #F58220', paddingLeft: '0.75rem' }}>
        {title}
      </h2>
      <div style={{ fontSize: '0.93rem', color: '#444', lineHeight: 1.75 }}>
        {children}
      </div>
    </div>
  )
}

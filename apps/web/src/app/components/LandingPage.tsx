import { Link } from 'react-router'

export function LandingPage() {
  return (
    <div style={{ fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", margin: 0, padding: 0, backgroundColor: '#fff', color: '#1a1a1a' }}>
      {/* ── Nav ─────────────────────────────────────────────────── */}
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '1rem 1.5rem', borderBottom: '1px solid #f0f0f0',
        position: 'sticky', top: 0, backgroundColor: '#fff', zIndex: 100,
        boxShadow: '0 1px 8px rgba(0,0,0,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <img src="/icons/icon-192.webp" alt="Let's Out" style={{ height: '40px', width: '40px', objectFit: 'cover', borderRadius: '10px' }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1a1a1a' }}>Let's Out</span>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Link to="/privacy" style={{ fontSize: '0.85rem', color: '#666', textDecoration: 'none' }}>
            Confidentialité
          </Link>
          <Link to="/terms" style={{ fontSize: '0.85rem', color: '#666', textDecoration: 'none' }}>
            CGU
          </Link>
          <Link to="/app" style={{
            backgroundColor: '#F58220', color: '#fff', padding: '0.5rem 1.2rem',
            borderRadius: '24px', textDecoration: 'none', fontSize: '0.85rem', fontWeight: 600
          }}>
            Ouvrir l'app
          </Link>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section style={{
        minHeight: '90vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '3rem 1.5rem 2rem',
        background: 'linear-gradient(160deg, #fff8f2 0%, #fff 60%)',
        textAlign: 'center'
      }}>
        <img
          src="/icons/icon-192.webp"
          alt="Let's Out — Application d'événements sociaux"
          style={{ width: 'min(120px, 30vw)', marginBottom: '2rem', objectFit: 'cover', borderRadius: '28px', boxShadow: '0 8px 32px rgba(245,130,32,0.25)' }}
        />
        <h1 style={{
          fontSize: 'clamp(2rem, 6vw, 3.2rem)', fontWeight: 800, lineHeight: 1.15,
          margin: '0 0 1rem', color: '#1a1a1a', maxWidth: '700px'
        }}>
          Rencontrez des gens,<br />
          <span style={{ color: '#F58220' }}>vivez des événements</span>
        </h1>
        <p style={{
          fontSize: 'clamp(1rem, 2.5vw, 1.2rem)', color: '#555', lineHeight: 1.65,
          maxWidth: '560px', margin: '0 0 2.5rem'
        }}>
          <strong>Let's Out</strong> est une application mobile sociale qui vous permet de créer,
          découvrir et rejoindre des événements et activités près de chez vous — sorties, soirées,
          randonnées, jeux de société, et bien plus. Rencontrez de nouvelles personnes partageant
          vos centres d'intérêt et mutualisez les frais en groupe.
        </p>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Link to="/app" style={{
            backgroundColor: '#F58220', color: '#fff', padding: '0.85rem 2rem',
            borderRadius: '32px', textDecoration: 'none', fontSize: '1rem', fontWeight: 700,
            boxShadow: '0 4px 18px rgba(245,130,32,0.35)'
          }}>
            Rejoindre Let's Out →
          </Link>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────── */}
      <section style={{ padding: '4rem 1.5rem', backgroundColor: '#fafafa' }}>
        <h2 style={{ textAlign: 'center', fontSize: 'clamp(1.4rem, 4vw, 2rem)', fontWeight: 700, marginBottom: '2.5rem', color: '#1a1a1a' }}>
          Comment ça marche ?
        </h2>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1.5rem', maxWidth: '960px', margin: '0 auto'
        }}>
          {[
            { emoji: '📍', title: 'Découvrez près de vous', desc: "Explorez les événements publics ou privés organisés autour de vous grâce à la carte interactive de l'application." },
            { emoji: '🎉', title: 'Créez votre événement', desc: 'Organisez une sortie, une soirée ou une activité en quelques secondes. Définissez le lieu, la date, le nombre de participants et le tarif.' },
            { emoji: '👥', title: 'Faites des rencontres', desc: 'Connectez-vous avec d\'autres participants, envoyez des demandes d\'amis et échangez via la messagerie intégrée.' },
            { emoji: '💰', title: 'Partagez les frais', desc: 'Financez vos sorties en groupe grâce au système de cagnotte partagée intégré à l\'application.' },
          ].map((f) => (
            <div key={f.title} style={{
              backgroundColor: '#fff', borderRadius: '16px', padding: '1.75rem',
              boxShadow: '0 2px 16px rgba(0,0,0,0.07)', display: 'flex', flexDirection: 'column', gap: '0.75rem'
            }}>
              <span style={{ fontSize: '2rem' }}>{f.emoji}</span>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: '#1a1a1a' }}>{f.title}</h3>
              <p style={{ margin: 0, fontSize: '0.9rem', color: '#666', lineHeight: 1.6 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Purpose / About ─────────────────────────────────────── */}
      <section style={{ padding: '4rem 1.5rem', maxWidth: '760px', margin: '0 auto' }}>
        <h2 style={{ fontSize: 'clamp(1.3rem, 3.5vw, 1.8rem)', fontWeight: 700, marginBottom: '1rem', color: '#1a1a1a' }}>
          À propos de Let's Out
        </h2>
        <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.75, margin: '0 0 1rem' }}>
          <strong>Let's Out</strong> est une plateforme sociale événementielle conçue pour faciliter les
          rencontres authentiques en dehors des réseaux sociaux traditionnels. Disponible sur iOS et Android,
          l'application connecte des personnes autour d'activités partagées dans leur ville.
        </p>
        <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.75, margin: '0 0 1rem' }}>
          L'authentification sur Let's Out utilise votre numéro de téléphone via un code OTP sécurisé
          (authentification Firebase). Aucun mot de passe n'est stocké. Vos données sont utilisées
          uniquement pour le bon fonctionnement du service.
        </p>
        <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.75 }}>
          Pour toute question, contactez-nous à <a href="mailto:contact@letsout.app" style={{ color: '#F58220', textDecoration: 'none' }}>contact@letsout.app</a>
        </p>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer style={{
        backgroundColor: '#1a1a1a', color: '#aaa',
        padding: '2.5rem 1.5rem', textAlign: 'center'
      }}>
        <img src="/icons/icon-192.webp" alt="Let's Out" style={{ height: '52px', width: '52px', objectFit: 'cover', borderRadius: '14px', marginBottom: '1rem' }} />
        <p style={{ margin: '0 0 1rem', fontSize: '0.85rem' }}>
          Let's Out — Trouvez des événements et vivez des expériences partagées
        </p>
        <div style={{ display: 'flex', gap: '1.5rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <Link to="/privacy" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.85rem' }}>Politique de confidentialité</Link>
          <Link to="/terms" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.85rem' }}>Conditions d'utilisation</Link>
          <a href="mailto:contact@letsout.app" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.85rem' }}>Contact</a>
        </div>
        <p style={{ margin: 0, fontSize: '0.75rem', color: '#666' }}>
          © {new Date().getFullYear()} Let's Out. Tous droits réservés.
        </p>
      </footer>
    </div>
  )
}

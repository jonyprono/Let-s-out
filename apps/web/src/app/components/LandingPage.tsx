import { Link } from 'react-router'

export function LandingPage() {
  return (
    <>
      <style>{`
        .lp-root {
          font-family: 'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          margin: 0;
          padding: 0;
          background: #fff;
          color: #1a1a1a;
          height: 100dvh;
          overflow-x: hidden;
          overflow-y: auto;
          width: 100%;
        }

        /* ── Nav ───────────────────────────────────────────────── */
        .lp-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.85rem 1rem;
          border-bottom: 1px solid #f0f0f0;
          position: sticky;
          top: 0;
          background: #fff;
          z-index: 100;
          box-shadow: 0 1px 8px rgba(0,0,0,0.06);
          box-sizing: border-box;
          width: 100%;
        }
        .lp-nav-brand {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          text-decoration: none;
        }
        .lp-nav-brand img {
          height: 38px;
          width: 38px;
          object-fit: cover;
          border-radius: 10px;
          flex-shrink: 0;
        }
        .lp-nav-brand span {
          font-weight: 700;
          font-size: 1rem;
          color: #1a1a1a;
          white-space: nowrap;
        }
        .lp-nav-links {
          display: flex;
          gap: 0.5rem;
          align-items: center;
          flex-shrink: 0;
        }
        .lp-nav-links a {
          font-size: 0.8rem;
          color: #666;
          text-decoration: none;
          white-space: nowrap;
        }
        .lp-nav-cta {
          background: #F58220;
          color: #fff !important;
          padding: 0.45rem 1rem;
          border-radius: 24px;
          font-size: 0.8rem !important;
          font-weight: 600;
        }
        @media (max-width: 480px) {
          .lp-nav-brand span { display: none; }
        }

        /* ── Hero ──────────────────────────────────────────────── */
        .lp-hero {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4rem 1.25rem 3rem;
          background: linear-gradient(160deg, #fff8f2 0%, #fff 60%);
          text-align: center;
          box-sizing: border-box;
          width: 100%;
        }
        .lp-hero-icon {
          width: 96px;
          height: 96px;
          object-fit: cover;
          border-radius: 24px;
          box-shadow: 0 12px 32px rgba(245,130,32,0.25);
          margin-bottom: 2rem;
          flex-shrink: 0;
        }
        .lp-hero h1 {
          font-size: clamp(1.75rem, 5.5vw, 3.2rem);
          font-weight: 800;
          line-height: 1.2;
          margin: 0 0 1rem;
          color: #1a1a1a;
          max-width: 680px;
        }
        .lp-hero h1 span { color: #F58220; }
        .lp-hero p {
          font-size: clamp(0.95rem, 2.2vw, 1.15rem);
          color: #555;
          line-height: 1.7;
          max-width: 540px;
          margin: 0 0 2rem;
        }
        .lp-btn-hero {
          display: inline-block;
          background: #F58220;
          color: #fff;
          padding: 0.85rem 2rem;
          border-radius: 32px;
          text-decoration: none;
          font-size: 1rem;
          font-weight: 700;
          box-shadow: 0 4px 18px rgba(245,130,32,0.35);
          white-space: nowrap;
        }

        /* ── Features ──────────────────────────────────────────── */
        .lp-features {
          padding: 3.5rem 1.25rem;
          background: #fafafa;
          box-sizing: border-box;
          width: 100%;
        }
        .lp-features h2 {
          text-align: center;
          font-size: clamp(1.3rem, 4vw, 2rem);
          font-weight: 700;
          margin: 0 0 2rem;
          color: #1a1a1a;
        }
        .lp-grid {
          display: flex;
          overflow-x: auto;
          scroll-snap-type: x mandatory;
          gap: 1.25rem;
          padding: 1rem 0.5rem;
          margin: 0 auto;
          max-width: 1000px;
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE/Edge */
        }
        .lp-grid::-webkit-scrollbar {
          display: none; /* Chrome/Safari */
        }
        @media (min-width: 860px) {
          .lp-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            overflow-x: visible;
            padding: 1rem 0;
          }
        }
        .lp-card {
          background: #fff;
          border-radius: 24px;
          padding: 2rem;
          box-shadow: 0 4px 24px rgba(0,0,0,0.04);
          border: 1px solid #f0f0f0;
          box-sizing: border-box;
          min-width: 280px;
          flex-shrink: 0;
          scroll-snap-align: center;
          display: flex;
          flex-direction: column;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .lp-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.08);
        }
        @media (min-width: 860px) {
          .lp-card { min-width: 0; }
        }
        .lp-icon-wrapper {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: #FFF1E5;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 1.5rem;
        }
        .lp-card-emoji {
          font-size: 1.75rem;
          line-height: 1;
        }
        .lp-card h3 {
          margin: 0 0 0.75rem;
          font-size: 1.1rem;
          font-weight: 700;
          color: #1a1a1a;
        }
        .lp-card p {
          margin: 0;
          font-size: 0.95rem;
          color: #666;
          line-height: 1.6;
        }

        /* ── About ─────────────────────────────────────────────── */
        .lp-about {
          padding: 3.5rem 1.25rem;
          max-width: 760px;
          margin: 0 auto;
          box-sizing: border-box;
          width: 100%;
        }
        .lp-about h2 {
          font-size: clamp(1.2rem, 3.5vw, 1.8rem);
          font-weight: 700;
          margin: 0 0 1rem;
          color: #1a1a1a;
        }
        .lp-about p {
          font-size: 0.95rem;
          color: #555;
          line-height: 1.75;
          margin: 0 0 1rem;
        }
        .lp-about a { color: #F58220; text-decoration: none; }

        /* ── Footer ────────────────────────────────────────────── */
        .lp-footer {
          background: #1a1a1a;
          color: #aaa;
          padding: 2.5rem 1.25rem;
          text-align: center;
          box-sizing: border-box;
          width: 100%;
        }
        .lp-footer img {
          height: 52px;
          width: 52px;
          object-fit: cover;
          border-radius: 14px;
          margin-bottom: 1rem;
        }
        .lp-footer p {
          margin: 0 0 1rem;
          font-size: 0.85rem;
        }
        .lp-footer-links {
          display: flex;
          gap: 1.25rem;
          justify-content: center;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }
        .lp-footer-links a {
          color: #aaa;
          text-decoration: none;
          font-size: 0.82rem;
        }
        .lp-copyright {
          font-size: 0.75rem;
          color: #666;
        }
      `}</style>

      <div className="lp-root">
        {/* ── Nav ────────────────────────────────────────────────── */}
        <nav className="lp-nav">
          <div className="lp-nav-brand">
            <img src="/icons/icon-192.webp" alt="Let's Out" />
            <span>Let's Out</span>
          </div>
          <div className="lp-nav-links">
            <Link to="/privacy" className="lp-nav-link">Confidentialité</Link>
            <Link to="/terms" className="lp-nav-link">CGU</Link>
            <Link to="/app" className="lp-nav-cta">Ouvrir l'app</Link>
          </div>
        </nav>

        {/* ── Hero ───────────────────────────────────────────────── */}
        <section className="lp-hero">
          <img
            src="/icons/icon-192.webp"
            alt="Let's Out"
            className="lp-hero-icon"
          />
          <h1>
            Rencontrez des gens,<br />
            <span>vivez des événements</span>
          </h1>
          <div className="lp-grid" style={{ marginBottom: '2.5rem', marginTop: '1.5rem', textAlign: 'left' }}>
            {[
              { emoji: '📍', title: 'Découvrir', desc: "Explorez les événements publics ou privés organisés autour de vous sur la carte interactive." },
              { emoji: '🎉', title: 'Organiser', desc: "Créez une sortie ou une activité en quelques secondes et invitez d'autres personnes." },
              { emoji: '👥', title: 'Rencontrer', desc: "Faites-vous de nouveaux amis partageant vos centres d'intérêt via la messagerie." },
              { emoji: '💰', title: 'Partager', desc: "Mutualisez les frais de vos sorties grâce au système de cagnotte partagée intégré." },
            ].map((f) => (
              <div key={f.title} className="lp-card">
                <div className="lp-icon-wrapper">
                  <span className="lp-card-emoji">{f.emoji}</span>
                </div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>

          <Link to="/app" className="lp-btn-hero">Rejoindre Let's Out →</Link>
        </section>

        {/* ── About ──────────────────────────────────────────────── */}
        <section className="lp-about">
          <h2>À propos de Let's Out</h2>
          <p>
            <strong>Let's Out</strong> est une plateforme sociale événementielle conçue pour faciliter les
            rencontres authentiques en dehors des réseaux sociaux traditionnels. Disponible sur iOS et Android,
            l'application connecte des personnes autour d'activités partagées dans leur ville.
          </p>
          <p>
            L'authentification sur Let's Out utilise votre numéro de téléphone via un code OTP sécurisé
            (authentification Firebase). Aucun mot de passe n'est stocké. Vos données sont utilisées
            uniquement pour le bon fonctionnement du service.
          </p>
          <p>
            Pour toute question, contactez-nous à{' '}
            <a href="mailto:contact@letsout.app">contact@letsout.app</a>
          </p>
        </section>

        {/* ── Privacy Summary ────────────────────────────────────── */}
        <section className="lp-about" id="privacy-summary" style={{ background: '#f5f5f5', borderRadius: '16px', marginTop: '1rem', marginBottom: '3rem' }}>
          <h2>Confidentialité & Conditions</h2>
          <p>
            Chez <strong>Let's Out</strong>, la protection de vos données est une priorité. L'authentification
            se fait de manière sécurisée via <strong>Firebase (OTP)</strong> ou <strong>Google Sign-In</strong>.
          </p>
          <ul style={{ paddingLeft: '1.5rem', marginBottom: '1rem', color: '#555', fontSize: '0.95rem', lineHeight: '1.75' }}>
            <li><strong>Données collectées :</strong> Numéro de téléphone, nom, photo de profil, et données d'événements.</li>
            <li><strong>Utilisation :</strong> Strictement limitées au fonctionnement de l'application (événements, messagerie). <strong>Jamais vendues à des tiers.</strong></li>
            <li><strong>Vos droits (RGPD) :</strong> Accès, rectification, et suppression complète de vos données sur simple demande.</li>
          </ul>
          <p>
            Consultez notre <Link to="/privacy" style={{ fontWeight: 600 }}>Politique de confidentialité complète</Link> et nos <Link to="/terms" style={{ fontWeight: 600 }}>Conditions d'utilisation</Link>.
          </p>
        </section>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="lp-footer">
          <img src="/icons/icon-192.webp" alt="Let's Out" />
          <p>Let's Out — Trouvez des événements et vivez des expériences partagées</p>
          <div className="lp-footer-links">
            <Link to="/privacy" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.82rem' }}>Politique de confidentialité</Link>
            <Link to="/terms" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.82rem' }}>Conditions d'utilisation</Link>
            <a href="mailto:contact@letsout.app" style={{ color: '#aaa', textDecoration: 'none', fontSize: '0.82rem' }}>Contact</a>
          </div>
          <p className="lp-copyright">© {new Date().getFullYear()} Let's Out. Tous droits réservés.</p>
        </footer>
      </div>
    </>
  )
}

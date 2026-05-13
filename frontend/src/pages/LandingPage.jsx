import { Link } from 'react-router-dom';

const AuthIcon = ({ type }) => (
  <span className="nav-auth-icon" aria-hidden="true">
    {type === 'login' ? (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M15 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2" />
        <path d="M10 17l5-5-5-5" />
        <path d="M15 12H3" />
      </svg>
    ) : (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </svg>
    )}
  </span>
);

export default function LandingPage() {
  return (
    <main className="landing-page">
      <header className="landing-nav">
        <div className="landing-nav__left">
          <Link to="/" className="brand-mark">
            ZeroWaste
          </Link>
          <a href="#capabilities">Explore Marketplace</a>
          <a href="#about-product">About Product</a>
        </div>
        <div className="landing-nav__right">
          <Link to="/auth?mode=login" className="nav-auth-btn nav-auth-btn--ghost">
            <AuthIcon type="login" />
            <span>Login</span>
          </Link>
          <Link to="/auth?mode=signup" className="nav-auth-btn">
            <AuthIcon type="signup" />
            <span>Signup</span>
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="hero-badge">SDG 12 • Circular Industry Network</span>
          <h1>
            One industrial exchange.
            <span> Greener circular outcomes.</span>
          </h1>
          <p>
            Zero-Waste Industrial Symbiosis Engine connects factories, recyclers, and buyers across Peenya through a modern marketplace for excess heat, scrap metal, steam waste, sludge, packaging remnants, and emerging reusable by-products.
          </p>
          <div className="hero-actions">
            <Link to="/auth" className="cta-btn">
              Launch Marketplace
            </Link>
            <a href="#capabilities" className="cta-btn cta-btn--secondary">
              Explore Concept
            </a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="orb-grid">
            <span className="orb orb--1" />
            <span className="orb orb--2" />
            <span className="orb orb--3" />
            <span className="line line--1" />
            <span className="line line--2" />
            <span className="line line--3" />
          </div>
        </div>
      </section>

      <section id="capabilities" className="info-grid">
        <article>
          <h2>Industrial Matching</h2>
          <p>Model non-linear waste exchange between factories using flexible MongoDB documents and interactive network visualization.</p>
        </article>
        <article>
          <h2>Guided Marketplace</h2>
          <p>Search approved listings by category, date added, price range, and use case to reach the right industrial match faster.</p>
        </article>
        <article>
          <h2>Admin-Approved Growth</h2>
          <p>Admins can approve uploads, review custom categories, manage account upgrades, and keep the exchange safe and useful.</p>
        </article>
      </section>

      <section id="about-product" className="about-grid landing-about">
        <div className="soft-card">
          <h2>About The Product</h2>
          <p>This website is designed to help industries share reusable by-products instead of treating them as waste, improving cost efficiency and reducing landfill burden.</p>
          <p>It combines a searchable marketplace, profile-based chat, sustainability scoring, and a live exchange network so factories can discover practical circular-economy collaborations in one place.</p>
        </div>
        <div className="soft-card">
          <h2>Built For Real Operators</h2>
          <p>Teams can upload materials, explain intended reuse, request new categories when niche materials appear, and coordinate directly with buyers or processors using the in-platform chat experience.</p>
        </div>
      </section>
    </main>
  );
}

import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <main className="landing-page">
      <section className="hero">
        <div className="hero-copy">
          <span className="hero-badge">SDG 12 • Circular Industry Network</span>
          <h1>Turn industrial waste into someone else’s resource.</h1>
          <p>
            Zero-Waste Industrial Symbiosis Engine connects factories, recyclers, and buyers across Peenya through a marketplace built for excess heat, scrap metal, steam waste, sludge, packaging remnants, and more.
          </p>
          <div className="hero-actions">
            <Link to="/auth" className="cta-btn">
              Launch Marketplace
            </Link>
            <a href="#why" className="ghost-link">
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

      <section id="why" className="info-grid">
        <article>
          <h2>Industrial Matching</h2>
          <p>Model non-linear waste exchange between factories using flexible MongoDB documents and interactive network visualization.</p>
        </article>
        <article>
          <h2>Paid Upload Tier</h2>
          <p>Normal users can request a monthly Rs.100 superior plan to publish listings, while admins verify payments and activate access.</p>
        </article>
        <article>
          <h2>Moderated Marketplace</h2>
          <p>Admins can review posts, reject harmful content, remove violating listings, and manage account upgrades centrally.</p>
        </article>
      </section>
    </main>
  );
}


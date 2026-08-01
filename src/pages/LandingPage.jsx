import React from 'react';

const features = [
  {
    mark: '✦',
    title: 'Keep the story with the photo',
    copy: 'Add the place, the people, and the little details you never want to forget.',
  },
  {
    mark: '⌁',
    title: 'See your life on a map',
    copy: 'Bring separate stops together and watch your family journeys take shape.',
  },
  {
    mark: '♡',
    title: 'Share it with your people',
    copy: 'Send a private journey to the family and friends who were there.',
  },
];

export default function LandingPage() {
  return (
    <main className="landing-page">
      <nav className="landing-nav" aria-label="Public navigation">
        <a className="landing-brand" href="/" aria-label="Postcards of Us home">
          <span className="landing-brand-mark" aria-hidden="true">P</span>
          <span>Postcards of Us</span>
        </a>
        <div className="landing-nav-actions">
          <span className="landing-beta-label">Private beta</span>
          <a className="landing-sign-in" href="/login">Sign in</a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">A private family travel storybook</p>
          <h1>Keep the places, people, and stories that made you.</h1>
          <p className="landing-lede">
            Postcards of Us turns the trips you have taken into a living family
            album—one place, one photo, and one memory at a time.
          </p>
          <div className="landing-actions">
            <a className="landing-primary-button" href="/login">Open your story</a>
            <a className="landing-text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <p className="landing-note">Private beta · Invitation required</p>
        </div>

        <div className="landing-postcard-scene" aria-label="A postcard-style preview of a family journey">
          <div className="landing-sun-stamp" aria-hidden="true">✦</div>
          <div className="landing-postcard landing-postcard-back" aria-hidden="true">
            <div className="landing-postcard-lines" />
          </div>
          <article className="landing-postcard landing-postcard-front">
            <div className="landing-postcard-photo">
              <div className="landing-photo-sky" />
              <div className="landing-photo-sun" />
              <div className="landing-photo-hills landing-photo-hills-one" />
              <div className="landing-photo-hills landing-photo-hills-two" />
              <div className="landing-photo-road" />
            </div>
            <div className="landing-postcard-body">
              <div>
                <p className="landing-postcard-label">Our journey</p>
                <h2>Somewhere beautiful</h2>
                <p>One of the places that became part of our story.</p>
              </div>
              <div className="landing-postmark" aria-hidden="true">
                <span>POSTCARDS</span>
                <strong>OF US</strong>
                <small>✦ 2026 ✦</small>
              </div>
            </div>
          </article>
          <div className="landing-route-card" aria-hidden="true">
            <span className="landing-route-dot landing-route-dot-start" />
            <span className="landing-route-line" />
            <span className="landing-route-dot landing-route-dot-end" />
            <span className="landing-route-label">A lifetime of places</span>
          </div>
        </div>
      </section>

      <section className="landing-belief" id="how-it-works">
        <p className="landing-kicker">Not a trip planner</p>
        <h2>A home for the trips that already happened.</h2>
        <p>
          Your family’s best stories should not be buried in a camera roll,
          scattered across old devices, or remembered by only one person.
        </p>
      </section>

      <section className="landing-features" aria-label="Features">
        {features.map(feature => (
          <article className="landing-feature" key={feature.title}>
            <span className="landing-feature-mark" aria-hidden="true">{feature.mark}</span>
            <h3>{feature.title}</h3>
            <p>{feature.copy}</p>
          </article>
        ))}
      </section>

      <section className="landing-cta" id="beta">
        <p className="landing-kicker">Already invited?</p>
        <h2>Your family’s stories are waiting for you.</h2>
        <p>Postcards of Us is currently welcoming a small group of families by invitation.</p>
        <a className="landing-primary-button landing-primary-button-light" href="/login">Sign in to Postcards</a>
      </section>

      <footer className="landing-footer">
        <span>Postcards of Us</span>
        <span>Private by default. Made for your family.</span>
      </footer>
    </main>
  );
}

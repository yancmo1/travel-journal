import React from 'react';
import { BookOpen, Camera, MapPin, Milestone, Share2 } from 'lucide-react';
import stampLogo from '../../assets/postcards-of-us-stamp.webp';
import postmark from '../../assets/postmark.webp';
import travelPaperBackground from '../../assets/travel-paper-background.webp';
import alaskaPostcard from '../../assets/alaska-postcard.webp';

const featuredPostcard = {
  image: alaskaPostcard,
  alt: 'A family standing beside the Alaska welcome sign in the mountains',
  label: 'Our journey',
  title: 'Alaska, 2026',
  copy: 'One of the places that became part of our story.',
};

const memoryFlow = [
  {
    icon: Camera,
    title: 'Add a memory',
    copy: 'Choose the place, date, people, and photos. Add the little detail your camera roll cannot remember for you.',
  },
  {
    icon: MapPin,
    title: 'Watch your atlas grow',
    copy: 'Each memory takes its place on your family map and returns to the surface when you want to wander back.',
  },
  {
    icon: BookOpen,
    title: 'Bring the trip together',
    copy: 'Gather related stops into a journey you can revisit, privately share, or print as a keepsake.',
  },
];

export default function LandingPage() {
  return (
    <main className="landing-page" style={{ '--landing-paper-art': `url(${travelPaperBackground})` }}>
      <nav className="landing-nav" aria-label="Public navigation">
        <a className="landing-brand" href="/" aria-label="Postcards of Us home">
          <span className="landing-brand-stamp" aria-hidden="true"><img src={stampLogo} alt="" /></span>
          <span className="landing-brand-tagline">Our story, one memory at a time</span>
        </a>
        <div className="landing-nav-actions">
          <span className="landing-beta-label">Private beta</span>
          <a className="landing-sign-in" href="/?login=1">Sign in</a>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-kicker">A private family travel storybook</p>
          <h1>Keep the places, people, and stories that made you.</h1>
          <p className="landing-lede">
            Postcards of Us turns the places and moments you remember into a living family
            album—one place, one photo, and one memory at a time.
          </p>
          <div className="landing-actions">
            <a className="landing-primary-button" href="/?login=1">Open your story</a>
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
            <img className="landing-postcard-photo" src={featuredPostcard.image} alt={featuredPostcard.alt} />
            <div className="landing-postcard-body">
              <div>
                <p className="landing-postcard-label">{featuredPostcard.label}</p>
                <h2>{featuredPostcard.title}</h2>
                <p>{featuredPostcard.copy}</p>
              </div>
              <img className="landing-postmark" src={postmark} alt="" aria-hidden="true" />
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
        <h2>Come inside. This is what your family sees.</h2>
        <p>
          Not another folder of uploads—a private place where every stop becomes
          part of the bigger story your family is still writing.
        </p>
      </section>

      <section className="landing-product-tour" aria-label="Inside Postcards of Us">
        <article className="landing-tour-chapter landing-tour-atlas">
          <figure className="landing-product-window landing-product-window-atlas">
            <div className="landing-window-bar" aria-hidden="true">
              <span />
              <p>Live family journal</p>
            </div>
            <img
              src="/marketing/live-family-atlas.webp"
              alt="The Postcards of Us family atlas showing a map of visited places and a row of recent memories"
            />
            <figcaption>Real view from inside Postcards of Us</figcaption>
          </figure>

          <div className="landing-tour-copy">
            <MapPin aria-hidden="true" />
            <h3>Your history, all in one glance.</h3>
            <p>
              Open your journal and the places you have been are already waiting.
              See the map fill in, glance at the distance your family has traveled,
              and jump straight back into the newest moments.
            </p>
            <ul>
              <li>A living map built from your memories</li>
              <li>Recent photos and places, ready to revisit</li>
              <li>Separate private journals for every family story</li>
            </ul>
          </div>
        </article>

        <article className="landing-tour-chapter landing-tour-journey" id="journey-preview">
          <div className="landing-tour-copy">
            <Milestone aria-hidden="true" />
            <h3>One trip becomes one story.</h3>
            <p>
              Bring the stops, dates, and photos from a trip together in one
              journey. The route gives it shape; the memories make it yours.
            </p>
            <div className="landing-tour-actions">
              <span><Camera aria-hidden="true" /> Photos stay with each stop</span>
              <span><Share2 aria-hidden="true" /> Share by private link or save as a PDF</span>
            </div>
          </div>

          <figure className="landing-product-window landing-product-window-journey">
            <div className="landing-window-bar" aria-hidden="true">
              <span />
              <p>A complete journey</p>
            </div>
            <img
              src="/marketing/live-journey-story.webp"
              alt="An Alaskan cruise journey in Postcards of Us with its route map, dated stops, places, and photos"
            />
            <figcaption>Stops, photos, and the route—together at last</figcaption>
          </figure>
        </article>
      </section>

      <section className="landing-memory-flow" aria-labelledby="memory-flow-heading">
        <div className="landing-memory-flow-heading">
          <h2 id="memory-flow-heading">A memory takes a minute. The story lasts.</h2>
          <p>Start with the moment in front of you. Postcards takes care of where it belongs.</p>
        </div>
        <div className="landing-features">
          {memoryFlow.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <article className="landing-feature" key={feature.title}>
                <span className="landing-feature-step">{index + 1}</span>
                <Icon className="landing-feature-mark" aria-hidden="true" />
                <h3>{feature.title}</h3>
                <p>{feature.copy}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="landing-cta" id="beta">
        <p className="landing-kicker">Already invited?</p>
        <h2>Your family’s stories are waiting for you.</h2>
        <p>Postcards of Us is currently welcoming a small group of families by invitation.</p>
        <a className="landing-primary-button landing-primary-button-light" href="/?login=1">Sign in to Postcards</a>
      </section>

      <footer className="landing-footer">
        <span>Postcards of Us</span>
        <span>Private by default. Made for your family.</span>
      </footer>
    </main>
  );
}

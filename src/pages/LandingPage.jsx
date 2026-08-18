import React from 'react';
import { BookOpen, Camera, MapPin, Milestone, Share2 } from 'lucide-react';
import logo from '../../assets/postcards-of-us-logo.png';
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
          <span className="landing-brand-stamp"><img src={logo} alt="Postcards of Us" width="1254" height="1584" /></span>
        </a>
        <div className="landing-nav-actions">
          <span className="landing-beta-label">Free to begin</span>
          <a className="landing-plan-link" href="#plans">Plans</a>
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
            <a className="landing-primary-button" href="/?login=1&amp;signup=1">Start your free story</a>
            <a className="landing-text-link" href="#how-it-works">See how it works <span aria-hidden="true">↓</span></a>
          </div>
          <p className="landing-note">Start free · Private by default · No card required</p>
        </div>

        <div className="landing-postcard-scene" aria-label="A postcard-style preview of a family journey">
          <div className="landing-sun-stamp" aria-hidden="true">✦</div>
          <div className="landing-postcard landing-postcard-back" aria-hidden="true">
            <div className="landing-postcard-lines" />
          </div>
          <article className="landing-postcard landing-postcard-front">
            <img className="landing-postcard-photo" src={featuredPostcard.image} alt={featuredPostcard.alt} width="1600" height="1200" />
            <div className="landing-postcard-body">
              <div>
                <p className="landing-postcard-label">{featuredPostcard.label}</p>
                <h2>{featuredPostcard.title}</h2>
                <p>{featuredPostcard.copy}</p>
              </div>
              <img className="landing-postmark" src={postmark} alt="" aria-hidden="true" width="1693" height="929" />
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
              width="651"
              height="807"
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
              width="651"
              height="807"
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

      <section className="landing-plans" id="plans" aria-labelledby="plans-heading">
        <div className="landing-plans-heading">
          <h2 id="plans-heading">Start with the story. Grow into the archive.</h2>
          <p>
            Postcards is free to begin, with everything you need to make a private family
            story. When your archive grows, Plus gives it more room to keep going.
          </p>
        </div>

        <div className="landing-plans-grid">
          <article className="landing-plan-card landing-plan-card-free">
            <div className="landing-plan-card-topline">
              <div>
                <p className="landing-plan-name">Free</p>
                <p className="landing-plan-price">$0 <span>to begin</span></p>
              </div>
              <span className="landing-plan-badge">Start here</span>
            </div>
            <p className="landing-plan-intro">A complete, private place for your family’s first stories.</p>
            <ul className="landing-plan-list">
              <li>1 private household · 2 members</li>
              <li>3 journeys · roughly 150 photos</li>
              <li>250 MB of storage</li>
              <li>Full map, timeline, story, sharing, and export experience</li>
            </ul>
            <a className="landing-primary-button landing-plan-button" href="/?login=1&amp;signup=1">Create a Free account</a>
          </article>

          <article className="landing-plan-card landing-plan-card-plus">
            <div className="landing-plan-card-topline">
              <div>
                <p className="landing-plan-name">Plus</p>
                <p className="landing-plan-price">$59 <span>/ year</span></p>
              </div>
              <span className="landing-plan-alt-price">or $7.99 / month</span>
            </div>
            <p className="landing-plan-intro">More room for the people, places, and memories your family keeps adding.</p>
            <ul className="landing-plan-list">
              <li>More household members</li>
              <li>5 GB storage and unlimited journeys</li>
              <li>Unlimited private sharing</li>
              <li>Scheduled backups and priority support</li>
            </ul>
            <span className="landing-plan-coming-soon">Plus is coming soon</span>
          </article>
        </div>

        <p className="landing-plans-note">No card required. Your Free stories stay yours to view, edit, share, and export.</p>
      </section>

      <section className="landing-cta" id="beta">
        <p className="landing-kicker">Your story can start today</p>
        <h2>Make the first journey. Keep the story growing.</h2>
        <p>Start with a small private family archive. Add more when your memories call for it.</p>
        <a className="landing-primary-button landing-primary-button-light" href="/?login=1&amp;signup=1">Create a Free account</a>
      </section>

      <footer className="landing-footer">
        <span>Postcards of Us</span>
        <span>Private by default. Made for your family.</span>
      </footer>
    </main>
  );
}

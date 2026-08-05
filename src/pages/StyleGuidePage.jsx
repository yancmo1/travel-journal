import React from 'react';
import { ArrowRight, Camera, Check, Image, MapPin, Menu, Navigation, Settings, X } from 'lucide-react';
import stampLogo from '../../assets/postcards-of-us-stamp.webp';
import './StyleGuidePage.css';

const colorGroups = [
  {
    label: 'Forest',
    colors: [
      ['--brand-forest-950', '#0f3028', 'Deep navigation contrast'],
      ['--brand-forest-900', '#12392f', 'Sidebar and dark surfaces'],
      ['--brand-forest-800', '#173c31', 'Headings and primary text'],
      ['--brand-forest-700', '#23493b', 'Logo and supporting surfaces'],
    ],
  },
  {
    label: 'Paper',
    colors: [
      ['--brand-paper-50', '#fffdf5', 'High-contrast paper'],
      ['--brand-paper-100', '#f8efd9', 'Stamp and active navigation'],
      ['--brand-paper-200', '#f7f1e5', 'Main application canvas'],
      ['--brand-paper-300', '#e8dfc9', 'Map surround and empty states'],
    ],
  },
  {
    label: 'Accent',
    colors: [
      ['--brand-terracotta-500', '#b95835', 'Primary action and links'],
      ['--brand-terracotta-700', '#8e3d23', 'Pressed state and borders'],
      ['--brand-brass-700', '#8e6a32', 'Map and statistic icons'],
      ['--brand-brass-500', '#bfa477', 'Fine borders and details'],
    ],
  },
];

const tokenRows = [
  ['--brand-font-display', "'Playfair Display', Georgia, serif", 'Editorial headlines and meaningful numbers'],
  ['--brand-font-body', "'DM Sans', system-ui, sans-serif", 'Navigation, labels, controls, and body copy'],
  ['--brand-radius-sm', '4px', 'Tight cards and small controls'],
  ['--brand-radius-md', '7px', 'Buttons, nav items, and cards'],
  ['--brand-radius-lg', '9px', 'Map frame and feature surfaces'],
  ['--brand-shadow', '0 8px 22px rgba(42, 69, 57, .10)', 'Lifted interactive surfaces'],
  ['--brand-shadow-paper', '7px paper edge + soft shadow', 'Atlas/map framing'],
];

const spacingRows = [
  ['--brand-space-1', '4px'],
  ['--brand-space-2', '8px'],
  ['--brand-space-3', '12px'],
  ['--brand-space-4', '16px'],
  ['--brand-space-5', '24px'],
  ['--brand-space-6', '32px'],
  ['--brand-space-7', '48px'],
];

export default function StyleGuidePage() {
  return (
    <div className="brand-guide">
      <header className="brand-guide-hero">
        <div className="brand-guide-hero-copy">
          <p className="brand-guide-kicker">Postcards of Us · Design system</p>
          <h2>Make every screen feel like a keepsake.</h2>
          <p>
            This is the living visual reference for the product. The examples below use the same CSS custom properties that power the site.
          </p>
        </div>
        <img className="brand-guide-logo" src={stampLogo} alt="Postcards of Us stamp logo" />
      </header>

      <nav className="brand-guide-index" aria-label="Style guide sections">
        <a href="#brand-colors">Colors</a>
        <a href="#brand-type">Typography</a>
        <a href="#brand-tokens">Tokens</a>
        <a href="#brand-components">Components</a>
        <a href="#brand-rules">Rules</a>
      </nav>

      <div className="brand-guide-content">
        <section className="brand-guide-section" id="brand-colors">
          <div className="brand-guide-section-heading">
            <p className="brand-guide-kicker">01 · Palette</p>
            <h3>Forest, paper, and a little terracotta.</h3>
            <p>Forest gives the product its calm, grounded feeling. Paper makes it tactile. Terracotta is reserved for moments that deserve attention.</p>
          </div>
          <div className="brand-guide-color-groups">
            {colorGroups.map(group => (
              <div className="brand-guide-color-group" key={group.label}>
                <h4>{group.label}</h4>
                <div className="brand-guide-swatches">
                  {group.colors.map(([token, value, description]) => (
                    <div className="brand-guide-swatch" key={token}>
                      <span className="brand-guide-swatch-color" style={{ background: `var(${token})` }} />
                      <div>
                        <strong>{token}</strong>
                        <code>{value}</code>
                        <small>{description}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="brand-guide-section" id="brand-type">
          <div className="brand-guide-section-heading">
            <p className="brand-guide-kicker">02 · Typography</p>
            <h3>Editorial when it matters. Clear everywhere else.</h3>
            <p>Playfair Display carries memory and place. DM Sans keeps controls and explanations easy to read for every generation.</p>
          </div>
          <div className="brand-guide-type-specimen">
            <div className="brand-guide-type-display">
              <span>Display / Playfair Display</span>
              <h1>Where we’ve been,<br /><em>together.</em></h1>
              <h3>Your travel map</h3>
            </div>
            <div className="brand-guide-type-body">
              <span>Body / DM Sans</span>
              <p>Every place left us with a story. Keep the language warm, direct, and human.</p>
              <label>Email address<input type="email" placeholder="you@example.com" /></label>
              <p className="brand-guide-kicker">Kicker / 11px / letter-spaced</p>
            </div>
          </div>
        </section>

        <section className="brand-guide-section" id="brand-tokens">
          <div className="brand-guide-section-heading">
            <p className="brand-guide-kicker">03 · CSS tokens</p>
            <h3>One place to tune the feeling.</h3>
            <p>Change a token in <code>src/styles/brand-tokens.css</code>, and every component that uses it updates together.</p>
          </div>
          <div className="brand-guide-token-grid">
            <div className="brand-guide-token-card">
              <h4>Visual tokens</h4>
              {tokenRows.map(([token, value, use]) => (
                <div className="brand-guide-token-row" key={token}>
                  <code>{token}</code>
                  <span>{value}</span>
                  <small>{use}</small>
                </div>
              ))}
            </div>
            <div className="brand-guide-token-card">
              <h4>Spacing scale</h4>
              <div className="brand-guide-spacing-list">
                {spacingRows.map(([token, value]) => (
                  <div className="brand-guide-spacing-row" key={token}>
                    <code>{token}</code>
                    <span className="brand-guide-spacing-bar" style={{ width: `calc(${value} * 4)` }} />
                    <small>{value}</small>
                  </div>
                ))}
              </div>
              <p className="brand-guide-note"><strong>Rule of thumb:</strong> use the smallest spacing for relationships and the larger steps to separate stories.</p>
            </div>
          </div>
        </section>

        <section className="brand-guide-section" id="brand-components">
          <div className="brand-guide-section-heading">
            <p className="brand-guide-kicker">04 · Components</p>
            <h3>The pieces that make the system recognizable.</h3>
          </div>
          <div className="brand-guide-component-grid">
            <div className="brand-guide-demo-card">
              <h4>Actions</h4>
              <div className="brand-guide-button-row">
                <button className="brand-guide-button brand-guide-button-primary"><Camera size={18} /> Add a memory</button>
                <button className="brand-guide-button brand-guide-button-secondary">View memories <ArrowRight size={16} /></button>
              </div>
              <p>One terracotta primary action per surface. Secondary actions stay quiet.</p>
            </div>
            <div className="brand-guide-demo-card">
              <h4>Navigation states</h4>
              <div className="brand-guide-nav-demo">
                <span className="is-active"><Image size={17} /> Memories</span>
                <span><MapPin size={17} /> Places</span>
                <span><Settings size={17} /> Settings</span>
              </div>
              <p>Active navigation uses paper against forest. Icons support the label; they never replace it.</p>
            </div>
            <div className="brand-guide-demo-card">
              <h4>Travel summary</h4>
              <div className="brand-guide-stat-demo">
                <span><Image size={21} /><strong>90</strong><small>memories</small></span>
                <span><MapPin size={21} /><strong>70</strong><small>places</small></span>
                <span><Navigation size={21} /><strong>43,747</strong><small>miles</small></span>
              </div>
              <p>Numbers use the display face; labels remain explicit and readable.</p>
            </div>
            <div className="brand-guide-demo-card">
              <h4>Postcard memory</h4>
              <article className="brand-guide-memory-card">
                <div className="brand-guide-memory-photo" aria-hidden="true"><Image /></div>
                <strong>Banff, Canada</strong>
                <span>June 12, 2023</span>
                <ArrowRight aria-hidden="true" />
              </article>
              <p>Photo first, place second, date third. Keep metadata quiet.</p>
            </div>
            <div className="brand-guide-demo-card brand-guide-demo-card-wide">
              <h4>Map frame</h4>
              <div className="brand-guide-map-demo"><span><MapPin size={18} /> Quiet map, vivid memories.</span></div>
              <p>Maps should support the story with a low-contrast base layer, framed like a paper artifact.</p>
            </div>
            <div className="brand-guide-demo-card">
              <h4>Feedback</h4>
              <div className="brand-guide-feedback-row"><span className="brand-guide-feedback-success"><Check size={16} /> Saved safely</span><span className="brand-guide-feedback-error"><X size={16} /> Try again</span></div>
              <p>Use text and icons alongside color so state is never color-only.</p>
            </div>
          </div>
        </section>

        <section className="brand-guide-section" id="brand-rules">
          <div className="brand-guide-section-heading">
            <p className="brand-guide-kicker">05 · Guardrails</p>
            <h3>Design for the people coming back to their memories.</h3>
          </div>
          <div className="brand-guide-rules">
            <div><strong>Keep it legible.</strong><span>Comfortable type, obvious labels, and 44px minimum control heights.</span></div>
            <div><strong>Keep it personal.</strong><span>Use “Add a memory,” not “Create record.” Lead with the story, not the database.</span></div>
            <div><strong>Keep it calm.</strong><span>One focal point per screen. The map should never overpower the memories.</span></div>
            <div><strong>Keep it honest.</strong><span>Respect uncertain dates, private sharing states, and useful empty states.</span></div>
          </div>
        </section>
      </div>
    </div>
  );
}

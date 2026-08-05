---
tags:
  - area/ux
  - type/brand
status: active
---

# Postcards of Us — Brand Book

> Source of truth for the visual language of Postcards of Us.

## Brand idea

Postcards of Us is a private family travel atlas: warm, personal, tactile, and easy to return to. The interface should feel like opening a carefully kept box of postcards—not operating a generic analytics dashboard.

The emotional qualities are:

- **Keepsake:** paper, stamps, borders, gentle imperfections.
- **Editorial:** confident serif headlines and considered whitespace.
- **Welcoming:** forest green, warm cream, and human language.
- **Clear:** large type, obvious actions, generous touch targets.

## Visual north star

Use the approved reference composition as the default dashboard pattern:

1. A deep green navigation rail with the stamp logo.
2. A warm paper canvas.
3. A large two-line editorial headline.
4. One prominent terracotta action: “Add a memory.”
5. A simple travel summary row.
6. A framed map as the visual centerpiece.
7. Recent memories presented as postcard-like cards.

Avoid dense dashboard chrome, excessive gradients, tiny labels, or competing primary actions.

## Color system

The implementation source of truth is `src/styles/brand-tokens.css` in the travel-journal repository.

| Role | Token | Value | Use |
| --- | --- | --- | --- |
| Forest 950 | `--brand-forest-950` | `#0f3028` | Deepest navigation contrast |
| Forest 900 | `--brand-forest-900` | `#12392f` | Sidebar and major dark surfaces |
| Forest 800 | `--brand-forest-800` | `#173c31` | Headings and primary dark text |
| Forest 700 | `--brand-forest-700` | `#23493b` | Logo and supporting dark surfaces |
| Paper 50 | `--brand-paper-50` | `#fffdf5` | High-contrast paper surfaces |
| Paper 100 | `--brand-paper-100` | `#f8efd9` | Stamp and active navigation surface |
| Paper 200 | `--brand-paper-200` | `#f7f1e5` | Main application canvas |
| Paper 300 | `--brand-paper-300` | `#e8dfc9` | Empty states and map surround |
| Terracotta 500 | `--brand-terracotta-500` | `#b95835` | Primary action and accent |
| Terracotta 700 | `--brand-terracotta-700` | `#8e3d23` | Action border and pressed state |
| Brass 700 | `--brand-brass-700` | `#8e6a32` | Map/stat icon accent |
| Brass 500 | `--brand-brass-500` | `#bfa477` | Fine borders and stamp details |

## Typography

- **Display:** Playfair Display, semibold, for page titles, card titles, and meaningful numbers.
- **Body/UI:** DM Sans, regular through bold, for navigation, helper copy, labels, and controls.
- Headlines are sentence case, conversational, and short.
- Uppercase kicker labels are small, letter-spaced, and used sparingly.

## Layout and interaction

- Desktop navigation is a fixed 224px green rail; mobile navigation becomes a bottom bar.
- The main content has generous outer padding and a single visual focal point.
- Use 1px warm borders, modest corner radii, and paper-like shadows.
- Primary controls are at least 44px high; important touch targets should be larger.
- Cards reveal a photo first, then location and date. Metadata remains secondary.
- Maps sit inside a framed paper surround and remain visually quiet beneath memories.

## Voice

Prefer: “Add a memory,” “Your travel map,” “Recent memories,” “Where we’ve been, together,” and “Open our memories.”

Avoid: “Create record,” “Manage entities,” “Analytics overview,” and cold technical labels.

## Accessibility commitments

- Keep body text at a comfortable reading size.
- Keep actions visually distinct and keyboard focusable.
- Never communicate state by color alone.
- Preserve meaningful heading order and accessible names.
- Keep map controls available, but never make the map the only way to access a memory.

## Change workflow

1. Change a value in `src/styles/brand-tokens.css` first.
2. Use the variable in component CSS; avoid new one-off hex values.
3. Update this book when the brand meaning changes.
4. Verify desktop, tablet, mobile, keyboard focus, and the production build.

## Asset

The approved stamp logo is `assets/postcards-of-us-stamp.webp`. Use it as the primary brand mark in navigation and other identity-forward surfaces. The original PNG is preserved as a source asset; do not redraw the mark with CSS or replace it with a generic letter mark.

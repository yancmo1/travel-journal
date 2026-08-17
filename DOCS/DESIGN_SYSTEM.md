# Postcards of Us design system

This document is the implementation contract for the site's visual language. The living examples are available through the in-app Style guide, while the values are defined in `src/styles/brand-tokens.css`.

## Source of truth

Use these sources in order:

1. `src/styles/brand-tokens.css` — canonical colors, typography, spacing, radii, borders, and shadows.
2. `tailwind.config.cjs` — Tailwind names mapped to the canonical CSS variables.
3. `src/pages/StyleGuidePage.jsx` and `src/pages/StyleGuidePage.css` — visual examples and usage guidance.
4. Shared component styles in `src/index.css` and `src/components/` — component behavior built from the tokens.

Screens should consume tokens and shared components. They should not define a competing palette or foundational visual values.

## Visual language

- Forest is the structural and primary text family.
- Paper is the canvas, surface, and quiet background family.
- Terracotta is reserved for primary actions, links, emphasis, and attention states.
- Brass is used for fine borders, map/stat accents, and archival details.
- Playfair Display is for editorial headings and meaningful numbers.
- DM Sans is for body copy, navigation, labels, controls, and utility text.

## Token scales

Spacing uses `4 / 8 / 12 / 16 / 24 / 32 / 48px` through `--brand-space-1` to `--brand-space-7`.

Semantic aliases are preferred in screen-level code when the intent is more
important than the hue: `--brand-canvas`, `--brand-surface`,
`--brand-surface-soft`, `--brand-ink`, `--brand-ink-muted`,
`--brand-action`, `--brand-success`, `--brand-warning`, and
`--brand-danger`.

Radii use `4 / 7 / 9px` through `--brand-radius-sm`, `--brand-radius-md`, and `--brand-radius-lg`. Pills and circular controls may use `999px` or `50%` when their shape is semantic.

Interactive controls should provide at least a 44px hit target. The value may come from height, min-height, padding, or a larger touch wrapper, but it must remain usable on touch devices.

`--brand-control-height` is the standard 44px control height;
`--brand-control-height-compact` is reserved for non-touch compact controls.

## Screen layout rules

Authenticated pages share one shell geometry:

- Desktop sidebar reservation: `--brand-shell-sidebar-width` (224px)
- Compact sidebar reservation: `--brand-shell-sidebar-width-compact` (188px)
- Desktop horizontal gutter: `--brand-shell-gutter`
- Page start: `--brand-shell-top` (24px)
- Page bottom: `--brand-shell-bottom` (84px)

Page roots must fill the shared content lane. A screen may constrain an
individual reading surface or card when that is part of its content pattern,
but it must not introduce a second centered page canvas.

## Component rules

- Prefer shared button, input, card, modal, navigation, and feedback styles.
- Use the canonical token-backed Tailwind names such as `text-brand-forest-800`, `bg-brand-paper-100`, and `bg-brand-terracotta-500`.
- Use status colors only for status meaning; never rely on color alone to communicate success, warning, or error.
- Decorative artwork, Leaflet-generated markup, chart series, and photo crop geometry may remain local exceptions when they use the canonical palette.

## Change protocol

Before adding a visual value, search for an existing token or component. If the value is foundational, add it here and to `brand-tokens.css` first, then update consumers. If it is a true one-off exception, keep it local and document why.

Avoid raw palette values, legacy color names, arbitrary near-duplicate spacing, and screen-specific copies of shared controls.

## Audit notes

- The previous Ocean/Sunset palette is retired. New UI must use Forest/Paper/Terracotta.
- Map and chart integrations may need runtime color resolution because Leaflet and
  Chart.js consume inline or canvas colors; use `src/utils/brandTokens.js` rather
  than duplicating hex values.
- Inline SVG/HTML marker artwork may use CSS variables directly in its markup.
- Decorative artwork, photo crops, and third-party map markup remain local
  exceptions when their geometry or rendering model requires it.

## Change log

### 2026-08-17

- Changed: Added semantic role, shell geometry, control-height, and marker-shadow tokens.
- Changed: Updated the style guide to resolve live token values and document shell rules.
- Changed: Removed remaining Ocean/Sunset documentation and consumer drift.
- Affected components: public/shared surfaces, photo analyzer, maps, analytics, and operations style guide.

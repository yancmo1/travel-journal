// Home marker icon choices. Each option renders as the marker glyph inside the
// home badge (dark green circle with a cream glyph), shared between the map
// (Map.jsx) and the Settings picker so previews always match the marker.

const BADGE_BG = '#12392f';
const BADGE_FG = '#fff9ec';

export const HOME_ICONS = {
  h: {
    name: 'H',
    label: 'Letter H',
    glyph: `<span style="color:${BADGE_FG}; font: 600 11px Georgia, serif; line-height: 1;">H</span>`,
  },
  house: {
    name: 'House',
    label: 'House',
    glyph: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path d="M4.2 11.6 12 4.4l7.8 7.2" stroke="${BADGE_FG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6 10.8V19a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-8.2" stroke="${BADGE_FG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M10 20v-5h4v5" stroke="${BADGE_FG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
  },
  cabin: {
    name: 'Cabin',
    label: 'Cabin',
    glyph: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path d="M4.2 12.2 12 4.8l7.8 7.4" stroke="${BADGE_FG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6.2 11.2V19a1 1 0 0 0 1 1h9.6a1 1 0 0 0 1-1v-7.8" stroke="${BADGE_FG}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M6.4 15.2h11.2M6.4 18h11.2" stroke="${BADGE_FG}" stroke-width="1.2" stroke-linecap="round"/>
    </svg>`,
  },
  cottage: {
    name: 'Cottage',
    label: 'Cottage',
    glyph: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none">
      <path d="M9.5 4.6h3v2.4h2.2l1.6 1.8H19.2V20H4.8V8.8h3.3V4.6z" stroke="${BADGE_FG}" stroke-width="1.6" stroke-linejoin="round"/>
      <circle cx="12" cy="14.2" r="1.7" stroke="${BADGE_FG}" stroke-width="1.5"/>
      <path d="M9.6 20v-2.6h4.8V20" stroke="${BADGE_FG}" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`,
  },
};

export const HOME_ICON_IDS = Object.keys(HOME_ICONS);

// The full circular badge used as the map's home marker (and its Settings preview).
export function homeBadgeHtml(iconId) {
  const icon = HOME_ICONS[iconId] || HOME_ICONS.h;
  return `<div style="background: ${BADGE_BG}; width: 22px; height: 22px; border-radius: 50%; border: 3px solid ${BADGE_FG}; box-shadow: 0 2px 6px rgba(18,57,47,0.28); display: flex; align-items: center; justify-content: center;">${icon.glyph}</div>`;
}

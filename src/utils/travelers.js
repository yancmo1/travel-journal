// Keep the family order intentional instead of depending on database insertion time.
// The legacy aliases keep existing installations ordered until their names are corrected in People.
const FAMILY_ORDER = [
  ['Yancy', 'You'],
  ['Amber', 'Wife'],
  ['Josh', 'Test Child'],
  ['Jonathan'],
  ['Aden'],
  ['Charity'],
  ['Dawson'],
  ['Luke'],
  ['Adalynn'],
  ['Elayna'],
];

const FAMILY_RANKS = new Map(
  FAMILY_ORDER.flatMap((names, rank) => names.map(name => [name.toLowerCase(), rank]))
);

export function sortTravelers(travelers = []) {
  return [...travelers].sort((a, b) => {
    const aRank = FAMILY_RANKS.get(String(a.name || '').toLowerCase()) ?? Number.MAX_SAFE_INTEGER;
    const bRank = FAMILY_RANKS.get(String(b.name || '').toLowerCase()) ?? Number.MAX_SAFE_INTEGER;

    if (aRank !== bRank) return aRank - bRank;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

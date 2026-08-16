const RELATIONSHIP_RANKS = new Map([
  ['husband', 0], ['wife', 0], ['child', 1], ['grandchild', 2], ['other', 3],
]);

export function sortTravelers(travelers = []) {
  return [...travelers].sort((a, b) => {
    const aRank = RELATIONSHIP_RANKS.get(String(a.relationship || '').toLowerCase()) ?? 3;
    const bRank = RELATIONSHIP_RANKS.get(String(b.relationship || '').toLowerCase()) ?? 3;

    if (aRank !== bRank) return aRank - bRank;
    const aBranch = String(a.family_branch || '').toLowerCase();
    const bBranch = String(b.family_branch || '').toLowerCase();
    if (aBranch !== bBranch) return aBranch.localeCompare(bBranch);
    const aOrder = Number.isFinite(Number(a.display_order)) ? Number(a.display_order) : Number.MAX_SAFE_INTEGER;
    const bOrder = Number.isFinite(Number(b.display_order)) ? Number(b.display_order) : Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

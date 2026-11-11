// These are descriptive flags for final possession, not causal estimates.
function findTraps(hero) {
  if (!hero || !hero.base_sample || !Array.isArray(hero.augments)) return [];
  return hero.augments
    .filter(a => Number.isFinite(a.sample) && Number.isFinite(a.delta) &&
      a.sample >= 5000 && a.sample / hero.base_sample >= 0.03 && a.delta <= -3)
    .map(a => ({ ...a, holdingRate: a.sample / hero.base_sample }))
    .sort((a,b) => (b.holdingRate * -b.delta) - (a.holdingRate * -a.delta) || a.delta-b.delta || String(a.slug).localeCompare(String(b.slug)))
    .slice(0,3);
}
if (typeof module !== 'undefined') module.exports = { findTraps };

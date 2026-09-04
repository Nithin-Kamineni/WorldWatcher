/** Probability mass function for the sum of `count` uniform dice each with `sides` faces, via
 * iterative convolution. NdM is a bell curve (e.g. 2d4 peaks at 5), not a uniform 1/range -
 * this is what makes the editor's per-entry probability display honest. */
export function diceSumDistribution(count: number, sides: number): Map<number, number> {
  if (count <= 0 || sides <= 0) return new Map();
  let dist = new Map<number, number>();
  for (let face = 1; face <= sides; face++) dist.set(face, 1 / sides);
  for (let d = 1; d < count; d++) {
    const next = new Map<number, number>();
    for (const [sum, p] of dist) {
      for (let face = 1; face <= sides; face++) {
        const newSum = sum + face;
        next.set(newSum, (next.get(newSum) ?? 0) + p / sides);
      }
    }
    dist = next;
  }
  return dist;
}

/** Probability (0..1) that a roll of `count`d`sides` + `modifier` lands within [min, max]
 * inclusive. Used to show each range-strict entry's real odds next to its min/max fields. */
export function rangeProbability(count: number, sides: number, modifier: number, min: number | null, max: number | null): number {
  if (min === null || max === null || min > max || count <= 0 || sides <= 0) return 0;
  const dist = diceSumDistribution(count, sides);
  let total = 0;
  for (const [sum, p] of dist) {
    const value = sum + modifier;
    if (value >= min && value <= max) total += p;
  }
  return total;
}

/** Probability (0..1) of a weighted-pool/deck entry: its own weight over the column's total. */
export function weightProbability(weight: number | null, totalWeight: number): number {
  if (weight === null || weight <= 0 || totalWeight <= 0) return 0;
  return weight / totalWeight;
}

export function formatProbability(p: number): string {
  return `${(p * 100).toFixed(1)}%`;
}

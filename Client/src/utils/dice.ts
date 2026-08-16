export function rollDie(sides: number): number {
  return 1 + Math.floor(Math.random() * sides);
}

export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(sides));
}

/** Parses/rolls a simple dice expression: "2d4", "d100", "1d10", "d12 + d8",
 * "1d6 + 3" (a flat modifier term with no "d" is added as a constant). Used
 * for 5etools-style random-table dice expressions, which aren't always a
 * single NdM term. Unparseable terms are ignored. */
export function rollExpression(expression: string): { total: number; rolls: number[]; expression: string } {
  const rolls: number[] = [];
  let total = 0;
  const terms = expression.split('+').map((t) => t.trim());
  for (const term of terms) {
    const diceMatch = term.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const sides = parseInt(diceMatch[2], 10);
      const termRolls = rollDice(count, sides);
      rolls.push(...termRolls);
      total += termRolls.reduce((sum, r) => sum + r, 0);
      continue;
    }
    const flat = parseInt(term, 10);
    if (Number.isFinite(flat)) total += flat;
  }
  return { total, rolls, expression };
}

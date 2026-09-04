import type { RollResult, RollResultItem } from '../types/randomTable';

/** Flattens a server RollResult into the one-line-per-result plain text the session chat
 * stores, so a DM can drop what they just rolled into the running log in a single click
 * instead of retyping it. Nested (cascading/branching) results are indented under their
 * parent rather than lost. */

function diceLabel(item: RollResultItem): string {
  if (item.dice.length === 0) return '';
  const rolls = item.dice.map((die) => `d${die.sides}:${die.result}`).join(' + ');
  return item.dice.length > 1 ? `${rolls} = ${item.total}` : rolls;
}

function itemText(item: RollResultItem): string {
  const body = item.resolvedText ?? item.text ?? item.refHydrated?.name ?? '(no result)';
  return item.refHydrated && item.kind !== 'text' && !body.includes(item.refHydrated.name)
    ? `${body} (${item.refHydrated.name})`
    : body;
}

/** One rolled column/item as a single line - what the per-result "add to chat" button sends. */
export function rollResultItemToText(item: RollResultItem, tableName?: string): string {
  const dice = diceLabel(item);
  const prefix = [tableName, item.columnName].filter(Boolean).join(' / ');
  const head = prefix ? `${prefix}: ` : '';
  return `${head}${itemText(item)}${dice ? ` [${dice}]` : ''}`;
}

function itemLines(item: RollResultItem, depth: number): string[] {
  const lines = [`${'  '.repeat(depth)}${depth > 0 ? '- ' : ''}${rollResultItemToText(item)}`];
  if (item.nested) {
    item.nested.items.forEach((nested) => lines.push(...itemLines(nested, depth + 1)));
  }
  return lines;
}

/** The whole roll as a chat message: table name, the combined text when the format produces
 * one, then every rolled column. */
export function rollResultToText(result: RollResult): string {
  const lines = [`Rolled ${result.tableName}`];
  if (result.gatePassed !== null) lines.push(result.gatePassed ? 'Gate passed' : 'Gate failed');
  if (result.combinedText) lines.push(result.combinedText);
  result.items.forEach((item) => lines.push(...itemLines(item, result.combinedText ? 1 : 0)));
  return lines.join('\n');
}

import type { EncounterPrimaryType } from '../types/encounter';

const OBJECTIVES: Record<EncounterPrimaryType, string[]> = {
  combat: [
    'Break the enemy formation and force its leader to yield.', 'Hold the position until help arrives or the threat retreats.',
    'Recover the contested object and escape with it intact.', 'Protect the vulnerable target until it reaches safety.',
    'Capture a key opponent alive without losing control of the field.', 'Survive the assault and prevent reinforcements from joining it.',
    'Drive the enemy away by breaking its morale rather than killing every foe.', 'Reach the far side of the battlefield before the route closes.',
  ],
  social: [
    'Discover what the other party truly wants and secure a workable agreement.', 'Win access, information, or assistance without creating a new enemy.',
    'Expose the hidden lie before the conversation ends.', 'Shift the audience from hostile to cooperative through leverage or trust.',
    'Negotiate safe passage while preserving the party\'s resources and reputation.', 'Convince the key decision-maker to delay or reverse their plan.',
    'Learn the guarded secret without revealing the party\'s full intentions.', 'Defuse the dispute before it escalates into violence.',
  ],
  exploration: [
    'Find a safe route through the obstacle before conditions worsen.', 'Identify the danger, neutralize it, and preserve useful evidence.',
    'Locate the hidden point of interest and determine why it matters.', 'Cross the hazardous area without exhausting critical resources.',
    'Piece together the clues and reveal what happened here.', 'Reach the destination before the opportunity or trail disappears.',
    'Recover the concealed object while leaving the site stable.', 'Map a reliable path that others can follow safely.',
  ],
};

export function nextEncounterObjective(primaryType: EncounterPrimaryType | null, current?: string | null): string {
  const bank = OBJECTIVES[primaryType ?? 'combat'];
  const alternatives = bank.filter((objective) => objective !== current);
  return alternatives[Math.floor(Math.random() * alternatives.length)] ?? bank[0];
}

import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { StatBox, TraitsBlock, ChipList, FieldBlock } from './CreatureStatBlockDialog';
import { getCreatureImportanceOption, getCreatureRelationOption, type Creature } from '../../types/creature';

/** The Items window's inline (non-dialog) creature detail body - reuses CreatureStatBlockDialog's
 * structured pieces so a pinned/expanded NPC row shows the same Personality/Appearance/
 * Motivations/etc. fields as proper labeled sections instead of one truncated line of raw text. */
export function CreatureExpandedDetails({ creature }: { creature: Creature }) {
  const isNpc = creature.category === 'npc';

  return (
    <Stack spacing={0}>
      <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-around', mb: 1.5 }}>
        <StatBox label="AC" value={creature.ac} />
        <StatBox label="HP" value={creature.hpFormula ? `${creature.hp} (${creature.hpFormula})` : creature.hp} />
        <StatBox label="Speed" value={creature.speed} />
        <StatBox label="CR" value={creature.cr} />
      </Stack>

      {isNpc && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
          <Chip size="small" color={getCreatureRelationOption(creature.relation).color} label={getCreatureRelationOption(creature.relation).label} />
          <Chip size="small" color={getCreatureImportanceOption(creature.importance).color} label={getCreatureImportanceOption(creature.importance).label} />
          {creature.profession && <Chip size="small" variant="outlined" label={creature.profession} />}
          {creature.characterClass && (
            <Chip size="small" variant="outlined" label={creature.level ? `Level ${creature.level} ${creature.characterClass}` : creature.characterClass} />
          )}
        </Stack>
      )}

      {!isNpc && <TraitsBlock label="Traits" value={creature.traits} />}

      {isNpc && (
        <>
          <ChipList label="Personality" value={creature.traits} />
          <ChipList label="Appearance" value={creature.appearance} />
          <FieldBlock label="Motivations / Goals" value={creature.motivations} />
          <FieldBlock label="Pitfalls" value={creature.pitfalls} />
          <ChipList label="Secrets" value={creature.secrets} />
          <ChipList label="Relationships" value={creature.relationships} />
          <FieldBlock label="History" value={creature.history} />
          <FieldBlock label="Description" value={creature.description} />
        </>
      )}
    </Stack>
  );
}

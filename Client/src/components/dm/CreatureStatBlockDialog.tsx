import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DescriptionIcon from '@mui/icons-material/Description';
import NoteAddIcon from '@mui/icons-material/NoteAdd';
import { useArticleStore, getArticleForLinkedEntity } from '../../store/useArticleStore';
import {
  abilityModifier,
  formatModifier,
  getCreatureImportanceOption,
  getCreatureRelationOption,
  type AbilityScores,
  type Creature,
} from '../../types/creature';

interface CreatureStatBlockDialogProps {
  open: boolean;
  creature: Creature | null;
  onClose: () => void;
  /** World this dialog is rendered under, if any - gates the "view/add article" button next
   * to the Combat/Roleplay toggle, since a linked article only makes sense within a world. */
  worldId?: string;
  onViewArticle?: (creature: Creature, articleId: string) => void;
  onAddArticle?: (creature: Creature) => void;
}

const ABILITY_LABELS: { key: keyof AbilityScores; label: string }[] = [
  { key: 'str', label: 'STR' },
  { key: 'dex', label: 'DEX' },
  { key: 'con', label: 'CON' },
  { key: 'int', label: 'INT' },
  { key: 'wis', label: 'WIS' },
  { key: 'cha', label: 'CHA' },
];

/** A boxed stat like AC/HP/Speed/CR in the header row. */
export function StatBox({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Box sx={{ textAlign: 'center', minWidth: 56 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {value}
      </Typography>
    </Box>
  );
}

export function AbilityBox({ label, score }: { label: string; score: number }) {
  const mod = abilityModifier(score);
  const modColor = mod > 0 ? 'success.main' : mod < 0 ? 'error.main' : 'text.secondary';
  return (
    <Box sx={{ textAlign: 'center', border: 1, borderColor: 'divider', borderRadius: 1.5, py: 1, flex: 1 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {score}
        <Typography component="span" variant="body2" sx={{ color: modColor, fontWeight: 700, ml: 0.5 }}>
          {formatModifier(mod)}
        </Typography>
      </Typography>
    </Box>
  );
}

/** Renders a freeform trait/action blob line-by-line, bolding the "name." lead-in of each
 * paragraph (e.g. "Multiattack.") the way an official stat block does, without requiring the
 * data model to store structured named abilities. */
export function TraitsBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  const paragraphs = value.split('\n').filter((p) => p.trim().length > 0);
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {label}
      </Typography>
      <Stack spacing={0.75}>
        {paragraphs.map((paragraph, i) => {
          const periodIndex = paragraph.indexOf('. ');
          if (periodIndex === -1 || periodIndex > 40) {
            return (
              <Typography key={i} variant="body2">
                {paragraph}
              </Typography>
            );
          }
          return (
            <Typography key={i} variant="body2">
              <Typography component="span" variant="body2" color="error.main" sx={{ fontWeight: 700 }}>
                {paragraph.slice(0, periodIndex + 1)}
              </Typography>
              {paragraph.slice(periodIndex + 1)}
            </Typography>
          );
        })}
      </Stack>
    </Box>
  );
}

/** Renders one of the itemized newline-joined fields (personality/appearance/secrets/
 * relationships) as a row of small outlined chips - the read-only counterpart to
 * ItemListField's editable chips in NpcFormDialog. */
export function ChipList({ label, value }: { label: string; value?: string }) {
  const items = (value ?? '').split('\n').map((s) => s.trim()).filter(Boolean);
  if (items.length === 0) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {label}
      </Typography>
      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
        {items.map((item, i) => (
          <Chip key={i} label={item} size="small" variant="outlined" />
        ))}
      </Stack>
    </Box>
  );
}

/** A labeled paragraph block for free-text fields (Motivations/Pitfalls/History/Description) -
 * the structured counterpart to InfoLine's cramped "Label: value" one-liner, used wherever a
 * field's value can run to multiple sentences. */
export function FieldBlock({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
        {label}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

function InfoLine({ label, value }: { label: string; value: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <Typography variant="body2" sx={{ mb: 0.25 }}>
      <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
        {label}:{' '}
      </Typography>
      {value}
    </Typography>
  );
}

export function CreatureStatBlockDialog({ open, creature, onClose, worldId, onViewArticle, onAddArticle }: CreatureStatBlockDialogProps) {
  const [viewMode, setViewMode] = useState<'combat' | 'roleplay'>('combat');
  useEffect(() => {
    if (open) setViewMode('combat');
  }, [open, creature?.id]);

  const articles = useArticleStore((s) => s.articles);

  if (!creature) return null;
  const isNpc = creature.category === 'npc';
  const showRoleplay = isNpc && viewMode === 'roleplay';
  const linkedArticle = isNpc ? getArticleForLinkedEntity(articles, worldId, 'npc', creature.id) : undefined;

  const identityChips = isNpc && (
    <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', gap: 1 }}>
      <Chip size="small" color={getCreatureRelationOption(creature.relation).color} label={getCreatureRelationOption(creature.relation).label} />
      <Chip size="small" color={getCreatureImportanceOption(creature.importance).color} label={getCreatureImportanceOption(creature.importance).label} />
      {creature.profession && <Chip size="small" variant="outlined" label={creature.profession} />}
      {creature.characterClass && (
        <Chip size="small" variant="outlined" label={creature.level ? `Level ${creature.level} ${creature.characterClass}` : creature.characterClass} />
      )}
    </Stack>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {creature.tokenImage ? (
            <Avatar src={creature.tokenImage} alt={creature.name} />
          ) : (
            <Avatar>{creature.name.charAt(0)}</Avatar>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6" component="div" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
              {creature.name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              {[creature.size, creature.type].filter(Boolean).join(' ')}
              {creature.alignment ? `, ${creature.alignment}` : ''}
            </Typography>
          </Box>
          {isNpc && worldId && (
            linkedArticle ? (
              <Tooltip title="View article">
                <IconButton size="small" onClick={() => onViewArticle?.(creature, linkedArticle.id)}>
                  <DescriptionIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            ) : (
              <Tooltip title="Add article">
                <IconButton size="small" onClick={() => onAddArticle?.(creature)}>
                  <NoteAddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )
          )}
          {isNpc && (
            <ToggleButtonGroup
              size="small"
              exclusive
              value={viewMode}
              onChange={(_e, v) => v && setViewMode(v)}
            >
              <ToggleButton value="combat">Combat</ToggleButton>
              <ToggleButton value="roleplay">Roleplay</ToggleButton>
            </ToggleButtonGroup>
          )}
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        {identityChips}

        {!showRoleplay && (
          <>
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-around', mb: 2 }}>
              <StatBox label="AC" value={creature.ac} />
              <StatBox label="HP" value={creature.hpFormula ? `${creature.hp} (${creature.hpFormula})` : creature.hp} />
              <StatBox label="Speed" value={creature.speed} />
              <StatBox label="CR" value={creature.cr} />
            </Stack>

            <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
              {ABILITY_LABELS.map(({ key, label }) => (
                <AbilityBox key={key} label={label} score={creature.abilities[key]} />
              ))}
            </Stack>

            <Box sx={{ mb: 2 }}>
              <InfoLine label="Skills" value={creature.skills} />
              <InfoLine label="Senses" value={creature.senses} />
              <InfoLine label="Passive Perception" value={creature.passivePerception} />
              <InfoLine label="Languages" value={creature.languages} />
              <InfoLine label="Proficiency" value={creature.proficiency ? `+${creature.proficiency}` : undefined} />
            </Box>

            {creature.traits && (
              <>
                <Divider sx={{ mb: 1.5 }} />
                <TraitsBlock label="Traits" value={creature.traits} />
              </>
            )}
          </>
        )}

        {showRoleplay && (
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
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

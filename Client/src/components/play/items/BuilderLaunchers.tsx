import { useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CasinoIcon from '@mui/icons-material/Casino';
import MapOutlinedIcon from '@mui/icons-material/MapOutlined';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import ShieldIcon from '@mui/icons-material/Shield';
import { QuickNpcRollDialog } from '../../dm/npc/QuickNpcRollDialog';
import { NpcFormDialog, type NpcRollPrefill } from '../../dm/NpcFormDialog';
import { PlaceBuilderDialog } from '../../world/PlaceBuilderDialog';
import { EncounterBuilderDialog } from '../../dm/encounter/EncounterBuilderDialog';
import { useCreatureStore } from '../../../store/useCreatureStore';
import { useEncounterStore } from '../../../store/useEncounterStore';
import { useEncounterDifficultySettingsStore } from '../../../store/useEncounterDifficultySettingsStore';
import { usePlayItemsStore } from '../../../store/usePlayItemsStore';
import type { ItemsSurface } from '../layout/playLayoutTrees';
import type { Creature } from '../../../types/creature';

/** Quick access to the NPC / Place / Encounter builders from inside the Play page's Items
 * sub-windows.
 *
 * These builders were added on the Encounters page (RandomTablesBrowseView surfaces them once
 * the matching category branch is selected) but were unreachable mid-session, which is exactly
 * when a DM needs to improvise an NPC, a place or a scene. Each launcher owns its own dialog
 * chain so a sub-window only has to drop the component in - the wiring (creature store writes,
 * the quick-roll -> NPC-form handoff, encounter party settings) is not repeated per tab. */

interface BuilderLaunchCardProps {
  icon: ReactNode;
  title: string;
  description: string;
  badge?: string;
  buttonLabel: string;
  onLaunch: () => void;
}

/** Compact sibling of the browse view's full-width builder banner - same visual language
 * (primary-tinted gradient, icon tile, action button) sized for a narrow Play pane. */
function BuilderLaunchCard({ icon, title, description, badge, buttonLabel, onLaunch }: BuilderLaunchCardProps) {
  return (
    <Paper
      variant="outlined"
      onClick={onLaunch}
      sx={{
        p: 1.25,
        mb: 1,
        borderRadius: 2,
        cursor: 'pointer',
        borderColor: 'primary.main',
        background: (theme) => `linear-gradient(135deg, ${theme.palette.primary.main}1f, ${theme.palette.background.paper} 70%)`,
        transition: '150ms',
        '&:hover': { boxShadow: 3, transform: 'translateY(-1px)' },
      }}
    >
      <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 2,
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
            '& .MuiSvgIcon-root': { fontSize: 20 },
          }}
        >
          {icon}
        </Box>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
              {title}
            </Typography>
            {badge && <Chip size="small" color="primary" label={badge} sx={{ height: 17, fontSize: 10, flexShrink: 0 }} />}
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {description}
          </Typography>
        </Box>
        <Button
          size="small"
          variant="contained"
          startIcon={<CasinoIcon sx={{ fontSize: 16 }} />}
          onClick={(event) => {
            event.stopPropagation();
            onLaunch();
          }}
          sx={{ flexShrink: 0, whiteSpace: 'nowrap' }}
        >
          {buttonLabel}
        </Button>
      </Stack>
    </Paper>
  );
}

/** NPC Builder - roll a character across the NPC generator's tables, then hand the results to
 * the full NPC form (new or existing creature) exactly as the Encounters page does. */
export function NpcBuilderLauncher({ worldId, campaignId }: { worldId: string; campaignId: string }) {
  const addCreatureToCampaign = useCreatureStore((s) => s.addCreatureToCampaign);
  const updateCreatureInCampaign = useCreatureStore((s) => s.updateCreatureInCampaign);
  const [rollOpen, setRollOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [prefill, setPrefill] = useState<NpcRollPrefill | undefined>();
  const [editing, setEditing] = useState<Creature | undefined>();

  const closeForm = () => {
    setFormOpen(false);
    setPrefill(undefined);
    setEditing(undefined);
  };

  return (
    <>
      <BuilderLaunchCard
        icon={<PersonAddAlt1Icon />}
        title="NPC Builder"
        description="Roll a name, look, job, motive and secret into one NPC."
        badge="Multi-table"
        buttonLabel="Build"
        onLaunch={() => setRollOpen(true)}
      />
      <QuickNpcRollDialog
        open={rollOpen}
        onClose={() => setRollOpen(false)}
        campaignId={campaignId}
        onAddToNew={(rolled) => {
          setEditing(undefined);
          setPrefill(rolled);
          setRollOpen(false);
          setFormOpen(true);
        }}
        onAddToExisting={(creature, rolled) => {
          setEditing(creature);
          setPrefill(rolled);
          setRollOpen(false);
          setFormOpen(true);
        }}
      />
      <NpcFormDialog
        open={formOpen}
        onClose={closeForm}
        campaignId={campaignId}
        worldId={worldId}
        initialCreature={editing}
        prefill={prefill}
        onSubmit={(creature) => {
          if (editing) updateCreatureInCampaign(campaignId, creature);
          else addCreatureToCampaign(campaignId, creature);
          closeForm();
        }}
      />
    </>
  );
}

/** Place Builder - rolls a country/settlement/building/dungeon into a structured world
 * article. The new article lands in this world's catalog, which is what the Places sub-window
 * already browses, so it shows up as soon as it is created. */
export function PlaceBuilderLauncher({ worldId, campaignId, slot }: { worldId: string; campaignId: string; slot: ItemsSurface }) {
  const [open, setOpen] = useState(false);
  const focusItem = usePlayItemsStore((s) => s.focusItem);

  return (
    <>
      <BuilderLaunchCard
        icon={<MapOutlinedIcon />}
        title="Place Builder"
        description="Roll a country, settlement, building or dungeon."
        badge="Multi-table"
        buttonLabel="Build"
        onLaunch={() => setOpen(true)}
      />
      <PlaceBuilderDialog
        open={open}
        worldId={worldId}
        campaignId={campaignId}
        onClose={() => setOpen(false)}
        onCreated={(article) => {
          focusItem(campaignId, slot, 'places', article.id);
          setOpen(false);
        }}
      />
    </>
  );
}

/** Encounter Builder - rolls a combat/social/exploration scene against the assumed party, then
 * drops it into this campaign and selects it in the Encounters sub-window so it is immediately
 * on screen. */
export function EncounterBuilderLauncher({ campaignId, slot }: { campaignId: string; slot: ItemsSurface }) {
  const [open, setOpen] = useState(false);
  const addEncounterToCampaign = useEncounterStore((s) => s.addEncounterToCampaign);
  const party = useEncounterDifficultySettingsStore((s) => s.getParty(campaignId));
  const focusItem = usePlayItemsStore((s) => s.focusItem);

  return (
    <>
      <BuilderLaunchCard
        icon={<ShieldIcon />}
        title="Encounter Builder"
        description={`Roll a scene for ${party.partySize} at level ${party.partyLevel}.`}
        badge="Multi-table"
        buttonLabel="Build"
        onLaunch={() => setOpen(true)}
      />
      <EncounterBuilderDialog
        open={open}
        campaignId={campaignId}
        partySize={party.partySize}
        partyLevel={party.partyLevel}
        onClose={() => setOpen(false)}
        onAdd={(encounter) => {
          addEncounterToCampaign(campaignId, encounter);
          focusItem(campaignId, slot, 'encounters', encounter.id);
          setOpen(false);
        }}
      />
    </>
  );
}

/** The Random Tables sub-window's own strip - all three builders together, since that tab is
 * where a DM goes to "roll something up" and shouldn't have to know which of the other tabs
 * owns which builder. */
export function AllBuilderLaunchers({ worldId, campaignId, slot }: { worldId: string; campaignId: string; slot: ItemsSurface }) {
  return (
    <>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.75, mt: 0.25 }}>
        <AutoAwesomeIcon sx={{ fontSize: 15, color: 'text.secondary' }} />
        <Typography variant="overline" color="text.secondary">
          Builders
        </Typography>
      </Stack>
      <NpcBuilderLauncher worldId={worldId} campaignId={campaignId} />
      <PlaceBuilderLauncher worldId={worldId} campaignId={campaignId} slot={slot} />
      <EncounterBuilderLauncher campaignId={campaignId} slot={slot} />
    </>
  );
}

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import { RandomTablesBrowseView } from './RandomTablesBrowseView';
import { EncounterDetailDialog } from '../EncounterDetailDialog';
import { NpcFormDialog, type NpcRollPrefill } from '../NpcFormDialog';
import { QuickNpcRollDialog } from '../npc/QuickNpcRollDialog';
import { PlaceBuilderDialog, type PlaceType } from '../../world/PlaceBuilderDialog';
import { EncounterBuilderDialog } from '../encounter/EncounterBuilderDialog';
import { useEncounterStore } from '../../../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../../store/useCreatureStore';
import { useEncounterDifficultySettingsStore } from '../../../store/useEncounterDifficultySettingsStore';
import type { Encounter, EncounterPrimaryType } from '../../../types/encounter';
import type { Creature } from '../../../types/creature';

interface RandomTablesSectionProps {
  campaignId: string;
  worldId?: string;
  /** Deep link from the Play page's Items window ("open in new tab" on a table row) - opens
   * that table's roll view as soon as its detail has loaded. */
  openTableId?: string;
  /** Crossing to the Encounters page. The two are separate rail destinations now, so this is a
   * real navigation rather than the old in-page `setView('management')`. */
  onGoToEncounters?: () => void;
}

/** The Random Tables page's body: the category-graph browser plus every builder and dialog it
 * can open.
 *
 * This is the half of the old EncountersSection that rendered `view === 'random_tables'`
 * (checklist R4). Tables and encounters were one rail button and one page with two screens;
 * they are two pages now, because they are two different jobs - "roll me something" arrives
 * with no specific object in mind and wants output in seconds, while "the ambush I built for
 * session 12" arrives knowing exactly what it wants.
 *
 * This page browses TABLES only. It briefly kept the Tables/Encounters kind toggle from the
 * old unified browse (Task 11.3), but once encounters had a page of their own that toggle was
 * just a filter for content belonging somewhere else, so it and the encounter list, its
 * category counts and its edit/delete/create plumbing are gone. What is left of the encounter
 * relationship is the two things that are not browsing: a roll result carrying an
 * `encounter_ref` opens that encounter read-only, and an encounter category offers its
 * generator - which files the result on the Encounters page and sends the DM there. */
export function RandomTablesSection({ campaignId, worldId, openTableId, onGoToEncounters }: RandomTablesSectionProps) {
  const [viewingEncounter, setViewingEncounter] = useState<Encounter | null>(null);
  const [npcBuilderOpen, setNpcBuilderOpen] = useState(false);
  const [placeBuilderOpen, setPlaceBuilderOpen] = useState(false);
  const [placeBuilderType, setPlaceBuilderType] = useState<PlaceType | undefined>();
  const [encounterBuilderOpen, setEncounterBuilderOpen] = useState(false);
  const [encounterBuilderType, setEncounterBuilderType] = useState<EncounterPrimaryType | undefined>();
  const [npcFormOpen, setNpcFormOpen] = useState(false);
  const [npcPrefill, setNpcPrefill] = useState<NpcRollPrefill | undefined>();
  const [editingNpc, setEditingNpc] = useState<Creature | undefined>();

  const party = useEncounterDifficultySettingsStore((s) => s.getParty(campaignId));

  const addEncounterToCampaign = useEncounterStore((s) => s.addEncounterToCampaign);
  const fetchEncounterById = useEncounterStore((s) => s.fetchEncounterById);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const addCreatureToCampaign = useCreatureStore((s) => s.addCreatureToCampaign);
  const updateCreatureInCampaign = useCreatureStore((s) => s.updateCreatureInCampaign);

  const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);

  // Creatures only. The whole encounter library used to be fetched here to feed the browse's
  // encounter half, and that is 200 individual detail requests (see
  // useEncounterStore.fetchEncountersForCampaign) for rows this page no longer lists.
  // `fetchEncounterById` still resolves a single encounter on demand for a roll result.
  useEffect(() => {
    fetchCreaturesForCampaign(campaignId);
  }, [campaignId, fetchCreaturesForCampaign]);

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 0 }}>
      <RandomTablesBrowseView
        campaignId={campaignId}
        openTableId={openTableId}
        onGoToEncounters={onGoToEncounters}
        onOpenEncounter={(id) => { void fetchEncounterById(campaignId, id).then((encounter) => setViewingEncounter(encounter)); }}
        onOpenNpcBuilder={() => setNpcBuilderOpen(true)}
        onOpenPlaceBuilder={worldId ? (type) => { setPlaceBuilderType(type); setPlaceBuilderOpen(true); } : undefined}
        onOpenEncounterBuilder={(type) => { setEncounterBuilderType(type); setEncounterBuilderOpen(true); }}
      />

      {/* Read-only: reached by rolling a table whose result references an encounter, never by
          browsing for one. Editing an encounter is the Encounters page's job. */}
      <EncounterDetailDialog
        encounter={viewingEncounter}
        creatures={creatures}
        campaignId={campaignId}
        onClose={() => setViewingEncounter(null)}
      />

      <QuickNpcRollDialog
        open={npcBuilderOpen}
        onClose={() => setNpcBuilderOpen(false)}
        campaignId={campaignId}
        onAddToNew={(prefill) => { setEditingNpc(undefined); setNpcPrefill(prefill); setNpcBuilderOpen(false); setNpcFormOpen(true); }}
        onAddToExisting={(creature, prefill) => { setEditingNpc(creature); setNpcPrefill(prefill); setNpcBuilderOpen(false); setNpcFormOpen(true); }}
      />

      {worldId && (
        <PlaceBuilderDialog
          open={placeBuilderOpen}
          worldId={worldId}
          campaignId={campaignId}
          initialType={placeBuilderType}
          onClose={() => setPlaceBuilderOpen(false)}
          onCreated={() => setPlaceBuilderOpen(false)}
        />
      )}

      <NpcFormDialog
        open={npcFormOpen}
        onClose={() => { setNpcFormOpen(false); setNpcPrefill(undefined); setEditingNpc(undefined); }}
        campaignId={campaignId}
        worldId={worldId}
        initialCreature={editingNpc}
        prefill={npcPrefill}
        onSubmit={(creature) => {
          if (editingNpc) updateCreatureInCampaign(campaignId, creature);
          else addCreatureToCampaign(campaignId, creature);
          setNpcFormOpen(false);
          setNpcPrefill(undefined);
          setEditingNpc(undefined);
        }}
      />

      {/* Rolling up an encounter from a generator lands it in the library, which lives on the
          other page - so this hands the DM over there rather than silently filing it. */}
      <EncounterBuilderDialog
        open={encounterBuilderOpen}
        campaignId={campaignId}
        initialType={encounterBuilderType}
        partySize={party.partySize}
        partyLevel={party.partyLevel}
        onClose={() => setEncounterBuilderOpen(false)}
        onAdd={(encounter) => { addEncounterToCampaign(campaignId, encounter); setEncounterBuilderOpen(false); onGoToEncounters?.(); }}
      />
    </Box>
  );
}

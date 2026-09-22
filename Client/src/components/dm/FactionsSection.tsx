import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ToggleButton from '@mui/material/ToggleButton';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import GroupsIcon from '@mui/icons-material/Groups';
import TableRowsIcon from '@mui/icons-material/TableRows';
import HubIcon from '@mui/icons-material/Hub';
import { FactionsTable } from './FactionsTable';
import { FactionCardDialog } from './FactionCardDialog';
import { FactionFormDialog } from './FactionFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { FactionsRelationsGraph } from './FactionsRelationsGraph';
import { useFactionStore, getFactionsForCampaign, getFactionRelationsForCampaign } from '../../store/useFactionStore';
import { useArticleStore } from '../../store/useArticleStore';
import { buildLinkedArticle } from '../../types/article';
import { FACTION_INFLUENCE_OPTIONS, type Faction, type FactionInfluence } from '../../types/faction';

interface FactionsSectionProps {
  campaignId: string;
  /** World this FactionsSection is rendered under, if any - threaded into FactionFormDialog
   * so it can offer the "also create a world article" checkbox (issue 4c/4g). */
  worldId?: string;
  /** Scopes the section to a single `Faction.factionType` - one of FACTION_TYPE_PRESETS, as
   * stored on the row. Powers the World manager's Guilds / Cults / Noble Houses / Criminal
   * Organizations / Military Orders / Religious Orders sidebar entries. Omit for all
   * factions, which is what the group heading itself renders. */
  factionType?: string;
  /** Heading text, defaulting to "Factions". The World manager passes the plural of the
   * scoped type ("Guilds") so the title matches the sidebar entry that was clicked. */
  heading?: string;
}

export function FactionsSection({ campaignId, worldId, factionType, heading }: FactionsSectionProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaction, setEditingFaction] = useState<Faction | undefined>(undefined);
  const [viewingFaction, setViewingFaction] = useState<Faction | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Faction | null>(null);

  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const addFactionToCampaign = useFactionStore((s) => s.addFactionToCampaign);
  const updateFactionInCampaign = useFactionStore((s) => s.updateFactionInCampaign);
  const deleteFactionFromCampaign = useFactionStore((s) => s.deleteFactionFromCampaign);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const relationsByCampaignId = useFactionStore((s) => s.relationsByCampaignId);
  const fetchRelationsForCampaign = useFactionStore((s) => s.fetchRelationsForCampaign);
  const addRelation = useFactionStore((s) => s.addRelation);
  const updateRelation = useFactionStore((s) => s.updateRelation);
  const deleteRelation = useFactionStore((s) => s.deleteRelation);

  const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);
  const relations = getFactionRelationsForCampaign(relationsByCampaignId, campaignId);

  useEffect(() => {
    fetchFactionsForCampaign(campaignId);
    fetchRelationsForCampaign(campaignId);
  }, [campaignId, fetchFactionsForCampaign, fetchRelationsForCampaign]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'graph'>('graph');
  const [influenceFilter, setInfluenceFilter] = useState<FactionInfluence[]>(
    FACTION_INFLUENCE_OPTIONS.filter((o) => o.value !== 'petty').map((o) => o.value),
  );

  /** Everything of the scoped type (or everything, unscoped) - the basis for "is this view
   * empty" as opposed to "did the search match nothing". */
  const typeScopedFactions = factionType ? factions.filter((f) => f.factionType === factionType) : factions;
  const filteredFactions = typeScopedFactions.filter((faction) => {
    const query = search.trim().toLowerCase();
    if (query && !faction.name.toLowerCase().includes(query)) return false;
    return true;
  });

  /** The diplomacy graph plots *relations*, which are inherently cross-type - a Guild's ties
   * run mostly to non-Guilds - so a graph scoped to one type would draw a misleading picture.
   * Type-scoped views are table-only; the unscoped view keeps both and its toggle. */
  const effectiveView = factionType ? 'table' : view;

  /** Link into an article opened from the faction card. `returnTo` carries the exact current
   * URL so the back arrow returns to the view you were in - the `from`-based fallback can
   * only name a folder key, which this component does not know (it sees a factionType, not
   * whether it is being rendered as "factions" or "factions-guilds"). */
  const articleHref = (articleId: string) =>
    `/w/${worldId}/manager/entry/${articleId}?from=factions&fromLabel=${encodeURIComponent(
      heading ?? 'Factions',
    )}&returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`;

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h2">
          {heading ?? 'Factions'}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Search">
            <IconButton color={filterOpen ? 'primary' : 'default'} onClick={() => setFilterOpen((v) => !v)}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <ToggleButtonGroup
            size="small"
            exclusive
            value={view}
            onChange={(_e, v) => v !== null && setView(v)}
            sx={{ display: factionType ? 'none' : undefined }}
          >
            <ToggleButton value="table" aria-label="Table view">
              <Tooltip title="Table view">
                <TableRowsIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
            <ToggleButton value="graph" aria-label="Diplomacy graph">
              <Tooltip title="Diplomacy graph">
                <HubIcon fontSize="small" />
              </Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
          {effectiveView === 'table' && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingFaction(undefined);
                setDialogOpen(true);
              }}
            >
              Add Faction
            </Button>
          )}
        </Stack>
      </Stack>

      {effectiveView === 'graph' ? (
        <>
          {filterOpen && (
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search factions by name…"
              hasActiveFilters={influenceFilter.length < FACTION_INFLUENCE_OPTIONS.length - 1}
              onClearFilters={() =>
                setInfluenceFilter(FACTION_INFLUENCE_OPTIONS.filter((o) => o.value !== 'petty').map((o) => o.value))
              }
            >
              <FilterChipGroup
                label="Influence / power shown"
                options={FACTION_INFLUENCE_OPTIONS.filter((o) => o.value !== 'petty')}
                selected={influenceFilter}
                onToggle={(value) =>
                  setInfluenceFilter((prev) =>
                    prev.includes(value as FactionInfluence)
                      ? prev.filter((v) => v !== value)
                      : [...prev, value as FactionInfluence],
                  )
                }
              />
            </FilterBar>
          )}
          <FactionsRelationsGraph
            campaignId={campaignId}
            search={search}
            influenceFilter={influenceFilter}
            onViewFactionCard={(faction) => setViewingFaction(faction)}
          />
        </>
      ) : (
        <>
          {filterOpen && (
            <FilterBar
              search={search}
              onSearchChange={setSearch}
              searchPlaceholder="Search factions by name…"
              hasActiveFilters={false}
              onClearFilters={() => {}}
            >
              <></>
            </FilterBar>
          )}

          {typeScopedFactions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
              <GroupsIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                No {heading?.toLowerCase() ?? 'factions'} yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {factionType ? `Add a ${factionType} to get started.` : 'Add a faction to get started.'}
              </Typography>
            </Box>
          ) : filteredFactions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No factions match your search.
            </Typography>
          ) : (
            <FactionsTable
              factions={filteredFactions}
              onView={(faction) => setViewingFaction(faction)}
              onEdit={(faction) => {
                setEditingFaction(faction);
                setDialogOpen(true);
              }}
              onDelete={(faction) => setDeleteTarget(faction)}
            />
          )}

          <FactionFormDialog
            open={dialogOpen}
            onClose={() => setDialogOpen(false)}
            initialFaction={editingFaction}
            campaignId={campaignId}
            allFactions={factions}
            relations={relations}
            onAddRelation={addRelation}
            onUpdateRelation={updateRelation}
            onDeleteRelation={deleteRelation}
            worldId={worldId}
            defaultFactionType={factionType}
            onSubmit={(faction, articleOutcome) => {
              if (editingFaction) updateFactionInCampaign(campaignId, faction);
              else addFactionToCampaign(campaignId, faction);
              setDialogOpen(false);
              setEditingFaction(undefined);
              if (worldId && articleOutcome) navigate(`/w/${worldId}/manager/entry/${articleOutcome.createdArticleId}`);
            }}
          />

          <ConfirmDeleteDialog
            open={!!deleteTarget}
            itemName={deleteTarget?.name ?? ''}
            itemType="faction"
            onCancel={() => setDeleteTarget(null)}
            onConfirm={() => {
              if (deleteTarget) deleteFactionFromCampaign(campaignId, deleteTarget.id);
              setDeleteTarget(null);
            }}
          />
        </>
      )}

      {/* Rendered outside the table/graph branches on purpose: the card is openable from a
          table row *and* from the diplomacy graph's detail panel, so one instance serves
          both views and the article link is built in one place. */}
      <FactionCardDialog
        open={!!viewingFaction}
        faction={viewingFaction}
        worldId={worldId}
        onClose={() => setViewingFaction(null)}
        onViewArticle={(_faction, articleId) => navigate(articleHref(articleId))}
        onAddArticle={(faction) => {
          if (!worldId) return;
          const article = buildLinkedArticle(worldId, 'faction', faction.id, faction.name);
          useArticleStore.getState().addArticle(article);
          navigate(articleHref(article.id));
        }}
      />
    </Box>
  );
}

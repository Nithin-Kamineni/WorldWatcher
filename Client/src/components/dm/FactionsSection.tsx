import { useEffect, useState } from 'react';
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
import { FactionFormDialog } from './FactionFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FactionsRelationsGraph } from './FactionsRelationsGraph';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import type { Faction } from '../../types/faction';

interface FactionsSectionProps {
  campaignId: string;
}

export function FactionsSection({ campaignId }: FactionsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaction, setEditingFaction] = useState<Faction | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Faction | null>(null);

  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const addFactionToCampaign = useFactionStore((s) => s.addFactionToCampaign);
  const updateFactionInCampaign = useFactionStore((s) => s.updateFactionInCampaign);
  const deleteFactionFromCampaign = useFactionStore((s) => s.deleteFactionFromCampaign);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);

  const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);

  useEffect(() => {
    fetchFactionsForCampaign(campaignId);
  }, [campaignId, fetchFactionsForCampaign]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'table' | 'graph'>('table');

  const filteredFactions = factions.filter((faction) => {
    const query = search.trim().toLowerCase();
    if (query && !faction.name.toLowerCase().includes(query)) return false;
    return true;
  });

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Factions
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
          {view === 'table' && (
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

      {view === 'graph' ? (
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
          <FactionsRelationsGraph campaignId={campaignId} search={search} />
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

          {factions.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
              <GroupsIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
              <Typography variant="h6" sx={{ mb: 0.5 }}>
                No factions yet
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Add a faction to get started.
              </Typography>
            </Box>
          ) : filteredFactions.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
              No factions match your search.
            </Typography>
          ) : (
            <FactionsTable
              factions={filteredFactions}
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
            onSubmit={(faction) => {
              if (editingFaction) updateFactionInCampaign(campaignId, faction);
              else addFactionToCampaign(campaignId, faction);
              setDialogOpen(false);
              setEditingFaction(undefined);
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
    </Box>
  );
}

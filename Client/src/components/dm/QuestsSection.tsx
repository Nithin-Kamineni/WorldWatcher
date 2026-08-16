import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import AssignmentIcon from '@mui/icons-material/Assignment';
import { QuestsTable } from './QuestsTable';
import { QuestFormDialog } from './QuestFormDialog';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { FilterBar } from './FilterBar';
import { FilterChipGroup } from './FilterChipGroup';
import { useQuestStore, getQuestsForCampaign } from '../../store/useQuestStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import { QUEST_STATUS_OPTIONS, type Quest } from '../../types/quest';

interface QuestsSectionProps {
  campaignId: string;
}

export function QuestsSection({ campaignId }: QuestsSectionProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingQuest, setEditingQuest] = useState<Quest | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Quest | null>(null);

  const questsByCampaignId = useQuestStore((s) => s.questsByCampaignId);
  const addQuestToCampaign = useQuestStore((s) => s.addQuestToCampaign);
  const updateQuestInCampaign = useQuestStore((s) => s.updateQuestInCampaign);
  const deleteQuestFromCampaign = useQuestStore((s) => s.deleteQuestFromCampaign);
  const fetchQuestsForCampaign = useQuestStore((s) => s.fetchQuestsForCampaign);

  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);

  const quests = getQuestsForCampaign(questsByCampaignId, campaignId);

  useEffect(() => {
    fetchQuestsForCampaign(campaignId);
    fetchFactionsForCampaign(campaignId);
  }, [campaignId, fetchQuestsForCampaign, fetchFactionsForCampaign]);

  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>([]);

  const filteredQuests = quests.filter((quest) => {
    const query = search.trim().toLowerCase();
    if (query && !quest.name.toLowerCase().includes(query)) return false;
    if (statusFilter.length > 0 && !statusFilter.includes(quest.status)) return false;
    return true;
  });

  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" component="h2">
          Quests
        </Typography>
        <Stack direction="row" spacing={1}>
          <Tooltip title="Search & filter">
            <IconButton color={filterOpen ? 'primary' : 'default'} onClick={() => setFilterOpen((v) => !v)}>
              <SearchIcon />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditingQuest(undefined);
              setDialogOpen(true);
            }}
          >
            Add Quest
          </Button>
        </Stack>
      </Stack>

      {filterOpen && (
        <FilterBar
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search quests by name…"
          hasActiveFilters={statusFilter.length > 0}
          onClearFilters={() => setStatusFilter([])}
        >
          <FilterChipGroup
            label="Status"
            options={QUEST_STATUS_OPTIONS}
            selected={statusFilter}
            onToggle={(v) => setStatusFilter((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]))}
          />
        </FilterBar>
      )}

      {quests.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
          <AssignmentIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
          <Typography variant="h6" sx={{ mb: 0.5 }}>
            No quests yet
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add a quest to start tracking your players' progress.
          </Typography>
        </Box>
      ) : filteredQuests.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
          No quests match your search/filters.
        </Typography>
      ) : (
        <QuestsTable
          quests={filteredQuests}
          onEdit={(quest) => {
            setEditingQuest(quest);
            setDialogOpen(true);
          }}
          onDelete={(quest) => setDeleteTarget(quest)}
          onUpdateQuest={(quest) => updateQuestInCampaign(campaignId, quest)}
        />
      )}

      <QuestFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        initialQuest={editingQuest}
        factions={factions}
        onSubmit={(quest) => {
          if (editingQuest) updateQuestInCampaign(campaignId, quest);
          else addQuestToCampaign(campaignId, quest);
          setDialogOpen(false);
          setEditingQuest(undefined);
        }}
      />

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="quest"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteQuestFromCampaign(campaignId, deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </Box>
  );
}

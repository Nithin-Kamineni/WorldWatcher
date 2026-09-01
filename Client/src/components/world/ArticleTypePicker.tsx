import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ButtonBase from '@mui/material/ButtonBase';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import LinkIcon from '@mui/icons-material/Link';
import BadgeIcon from '@mui/icons-material/Badge';
import PetsIcon from '@mui/icons-material/Pets';
import AutoStoriesIcon from '@mui/icons-material/AutoStories';
import DiamondIcon from '@mui/icons-material/Diamond';
import GroupsIcon from '@mui/icons-material/Groups';
import AssignmentIcon from '@mui/icons-material/Assignment';
import CastleIcon from '@mui/icons-material/Castle';
import {
  ARTICLE_GROUPS,
  getArticleTemplatesByGroup,
  buildLinkedArticle,
  LINKED_ENTITY_TYPE_LABEL,
  type ArticleCategory,
  type ArticleLinkedEntityType,
} from '../../types/article';
import { getArticleCategoryIcon } from './articleIcons';
import { useNavigate } from 'react-router-dom';
import { useArticleStore } from '../../store/useArticleStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useSpellStore, getSpellsForCampaign } from '../../store/useSpellStore';
import { useMagicItemStore, getMagicItemsForCampaign } from '../../store/useMagicItemStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import { useQuestStore, getQuestsForCampaign } from '../../store/useQuestStore';
import { useBastionStore, getBastionsForCampaign } from '../../store/useBastionStore';

const ENTITY_TILE_ICON: Record<ArticleLinkedEntityType, React.ReactNode> = {
  npc: <BadgeIcon />,
  creature: <PetsIcon />,
  spell: <AutoStoriesIcon />,
  item: <DiamondIcon />,
  faction: <GroupsIcon />,
  quest: <AssignmentIcon />,
  bastion: <CastleIcon />,
};

interface ExistingEntityOption {
  type: ArticleLinkedEntityType;
  id: string;
  name: string;
}

interface ArticleTypePickerProps {
  onPick: (category: ArticleCategory) => void;
  onPickEntity: (type: ArticleLinkedEntityType) => void;
  worldId: string;
  /** The world's primary campaign, if one exists - NPCs/Creatures/Spells/Magic items are
   * campaign-scoped, so "create article for an existing item" has nothing to list without one. */
  campaignId?: string;
}

const tileButtonSx = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 1,
  py: 3,
  borderRadius: 2,
  border: 1,
  borderColor: 'divider',
  color: 'text.secondary',
  '&:hover': { borderColor: 'primary.main', color: 'primary.main', bgcolor: 'action.hover' },
} as const;

/** The type-picker grid from Prompt Images/image copy 4.png - pick a category, get its
 * template (see types/article.ts's ARTICLE_TEMPLATES). Also fans out into the 4
 * ArticleLinkedEntityTypes (NPC/Creature/Spell/Magic item - issue 4a), whose actual creation
 * forms live in ArticleDetailPage, and a shortcut to link an article to something that
 * already exists (issue 4f). */
export function ArticleTypePicker({ onPick, onPickEntity, worldId, campaignId }: ArticleTypePickerProps) {
  const navigate = useNavigate();
  const [existingPickerOpen, setExistingPickerOpen] = useState(false);
  const [selected, setSelected] = useState<ExistingEntityOption | null>(null);

  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const spellsByCampaignId = useSpellStore((s) => s.spellsByCampaignId);
  const fetchSpellsForCampaign = useSpellStore((s) => s.fetchSpellsForCampaign);
  const magicItemsByCampaignId = useMagicItemStore((s) => s.magicItemsByCampaignId);
  const fetchMagicItemsForCampaign = useMagicItemStore((s) => s.fetchMagicItemsForCampaign);
  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const questsByCampaignId = useQuestStore((s) => s.questsByCampaignId);
  const fetchQuestsForCampaign = useQuestStore((s) => s.fetchQuestsForCampaign);
  const bastionsByCampaignId = useBastionStore((s) => s.bastionsByCampaignId);
  const fetchBastionsForCampaign = useBastionStore((s) => s.fetchBastionsForCampaign);

  useEffect(() => {
    if (!existingPickerOpen || !campaignId) return;
    fetchCreaturesForCampaign(campaignId);
    fetchSpellsForCampaign(campaignId);
    fetchMagicItemsForCampaign(campaignId);
    fetchFactionsForCampaign(campaignId);
    fetchQuestsForCampaign(campaignId);
    fetchBastionsForCampaign(campaignId);
  }, [
    existingPickerOpen,
    campaignId,
    fetchCreaturesForCampaign,
    fetchSpellsForCampaign,
    fetchMagicItemsForCampaign,
    fetchFactionsForCampaign,
    fetchQuestsForCampaign,
    fetchBastionsForCampaign,
  ]);

  const existingOptions = useMemo<ExistingEntityOption[]>(() => {
    if (!campaignId) return [];
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const npcs = creatures.filter((c) => c.category === 'npc').map((c) => ({ type: 'npc' as const, id: c.id, name: c.name }));
    const monsters = creatures
      .filter((c) => c.category === 'monster')
      .map((c) => ({ type: 'creature' as const, id: c.id, name: c.name }));
    const spells = getSpellsForCampaign(spellsByCampaignId, campaignId).map((s) => ({ type: 'spell' as const, id: s.id, name: s.name }));
    const items = getMagicItemsForCampaign(magicItemsByCampaignId, campaignId).map((i) => ({ type: 'item' as const, id: i.id, name: i.name }));
    const factions = getFactionsForCampaign(factionsByCampaignId, campaignId).map((f) => ({ type: 'faction' as const, id: f.id, name: f.name }));
    const quests = getQuestsForCampaign(questsByCampaignId, campaignId).map((q) => ({ type: 'quest' as const, id: q.id, name: q.name }));
    const bastions = getBastionsForCampaign(bastionsByCampaignId, campaignId).map((b) => ({ type: 'bastion' as const, id: b.id, name: b.name }));
    return [...npcs, ...monsters, ...spells, ...items, ...factions, ...quests, ...bastions];
  }, [
    campaignId,
    creaturesByCampaignId,
    spellsByCampaignId,
    magicItemsByCampaignId,
    factionsByCampaignId,
    questsByCampaignId,
    bastionsByCampaignId,
  ]);

  const handleLinkExisting = () => {
    if (!selected) return;
    const article = buildLinkedArticle(worldId, selected.type, selected.id, selected.name);
    useArticleStore.getState().addArticle(article);
    navigate(`/w/${worldId}/manager/entry/${article.id}`);
  };

  return (
    <Box sx={{ maxWidth: 720 }}>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        Create new
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Pick a type, get its template.
      </Typography>

      {campaignId && (
        <Button
          size="small"
          variant="outlined"
          startIcon={<LinkIcon fontSize="small" />}
          onClick={() => {
            setSelected(null);
            setExistingPickerOpen(true);
          }}
          sx={{ mb: 3 }}
        >
          Create article for an existing item
        </Button>
      )}

      <Box sx={{ mb: 3 }}>
        <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
          Game entities
        </Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
          {(Object.keys(LINKED_ENTITY_TYPE_LABEL) as ArticleLinkedEntityType[]).map((type) => (
            <ButtonBase key={type} onClick={() => onPickEntity(type)} sx={tileButtonSx}>
              <Box sx={{ fontSize: 28, display: 'flex' }}>{ENTITY_TILE_ICON[type]}</Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {LINKED_ENTITY_TYPE_LABEL[type]}
              </Typography>
            </ButtonBase>
          ))}
        </Box>
      </Box>

      {ARTICLE_GROUPS.map((group) => (
        <Box key={group} sx={{ mb: 3 }}>
          <Typography variant="overline" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            {group}
          </Typography>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 1.5 }}>
            {getArticleTemplatesByGroup(group).map((template) => (
              <ButtonBase key={template.category} onClick={() => onPick(template.category)} sx={tileButtonSx}>
                <Box sx={{ fontSize: 28, display: 'flex' }}>{getArticleCategoryIcon(template.icon)}</Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {template.label}
                </Typography>
              </ButtonBase>
            ))}
          </Box>
        </Box>
      ))}

      <Dialog open={existingPickerOpen} onClose={() => setExistingPickerOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Create article for an existing item</DialogTitle>
        <DialogContent dividers>
          <Autocomplete
            autoFocus
            options={existingOptions}
            value={selected}
            groupBy={(o) => LINKED_ENTITY_TYPE_LABEL[o.type]}
            getOptionLabel={(o) => o.name}
            isOptionEqualToValue={(a, b) => a.type === b.type && a.id === b.id}
            onChange={(_e, value) => setSelected(value)}
            renderInput={(params) => <TextField {...params} label="Search NPCs, creatures, spells, magic items…" autoFocus sx={{ mt: 1 }} />}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setExistingPickerOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button onClick={handleLinkExisting} variant="contained" disabled={!selected}>
            Create article
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

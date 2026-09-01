import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams, Navigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import FolderIcon from '@mui/icons-material/Folder';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { ComingSoon } from '../../components/shell/ComingSoon';
import { Breadcrumbs } from '../../components/layout/Breadcrumbs';
import { ArticleTypePicker } from '../../components/world/ArticleTypePicker';
import { ArticleForm } from '../../components/world/ArticleForm';
import { ArticleContentView } from '../../components/world/ArticleContentView';
import { NpcFormDialog } from '../../components/dm/NpcFormDialog';
import { CreatureFormDialog } from '../../components/dm/CreatureFormDialog';
import { SpellFormDialog } from '../../components/dm/SpellFormDialog';
import { MagicItemFormDialog } from '../../components/dm/MagicItemFormDialog';
import { FactionFormDialog } from '../../components/dm/FactionFormDialog';
import { QuestFormDialog } from '../../components/dm/QuestFormDialog';
import { BastionFormDialog } from '../../components/dm/BastionFormDialog';
import { useWorldStore, getWorldById, getPrimaryCampaignForWorld } from '../../store/useWorldStore';
import { useCampaignStore, getCampaignById } from '../../store/useCampaignStore';
import { useNavMemoryStore } from '../../store/useNavMemoryStore';
import { useCreatureStore } from '../../store/useCreatureStore';
import { useSpellStore } from '../../store/useSpellStore';
import { useMagicItemStore } from '../../store/useMagicItemStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import { useQuestStore } from '../../store/useQuestStore';
import { useBastionStore } from '../../store/useBastionStore';
import { useArticleStore, getArticleById, getFoldersForWorld } from '../../store/useArticleStore';
import { ARTICLE_TEMPLATES, type ArticleCategory, type ArticleLinkedEntityType } from '../../types/article';

/** Handles both /manager/entry/new (type picker -> form -> redirects to the new id) and
 * /manager/entry/:entryId (published reading view, with an Edit toggle back into the same
 * ArticleForm) - one page, local view/edit mode, mirroring the codebase's existing
 * "sub-view with a back arrow" pattern (CreaturesSection, EncountersSection). */
export function ArticleDetailPage() {
  const { worldId, entryId } = useParams<{ worldId: string; entryId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  /** Which sidebar folder (Settlements/NPCs/All entries/...) the user opened this article
   * from, if any - threaded onto the link by WorldManagerPage/NpcsSection so the breadcrumb
   * stays consistent with the entry point and the back arrow can return there directly. */
  const from = searchParams.get('from');
  const fromLabel = searchParams.get('fromLabel');
  /** Overrides backHref with an arbitrary absolute path - used when the entry point isn't a
   * World Manager folder (e.g. a Notes article's @-mention), so back/breadcrumb can return
   * there directly instead of falling back to the folder-based link below. */
  const returnTo = searchParams.get('returnTo');
  const backHref = returnTo ? decodeURIComponent(returnTo) : from ? `/w/${worldId}/manager?folder=${from}` : null;

  const worlds = useWorldStore((s) => s.worlds);
  const fetchWorlds = useWorldStore((s) => s.fetchWorlds);
  const world = getWorldById(worlds, worldId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);
  const activeCampaignByWorldId = useNavMemoryStore((s) => s.activeCampaignByWorldId);
  const primaryCampaign =
    getCampaignById(campaigns, activeCampaignByWorldId[worldId ?? '']) ?? getPrimaryCampaignForWorld(campaigns, worldId);
  const addCreatureToCampaign = useCreatureStore((s) => s.addCreatureToCampaign);
  const addSpellToCampaign = useSpellStore((s) => s.addSpellToCampaign);
  const addMagicItemToCampaign = useMagicItemStore((s) => s.addMagicItemToCampaign);
  const addFactionToCampaign = useFactionStore((s) => s.addFactionToCampaign);
  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const addQuestToCampaign = useQuestStore((s) => s.addQuestToCampaign);
  const addBastionToCampaign = useBastionStore((s) => s.addBastionToCampaign);
  const articles = useArticleStore((s) => s.articles);
  const folders = useArticleStore((s) => s.folders);
  const addArticle = useArticleStore((s) => s.addArticle);
  const updateArticle = useArticleStore((s) => s.updateArticle);
  const ensureSeeded = useArticleStore((s) => s.ensureSeeded);

  useEffect(() => {
    fetchWorlds();
    fetchCampaigns();
  }, [fetchWorlds, fetchCampaigns]);

  useEffect(() => {
    if (worldId) ensureSeeded(worldId);
  }, [worldId, ensureSeeded]);

  useEffect(() => {
    if (primaryCampaign) fetchFactionsForCampaign(primaryCampaign.id);
  }, [primaryCampaign, fetchFactionsForCampaign]);

  const isNew = !entryId;
  const existing = getArticleById(articles, entryId);
  const worldFolders = getFoldersForWorld(folders, worldId);

  const [mode, setMode] = useState<'view' | 'edit'>(isNew ? 'edit' : 'view');
  const [pendingCategory, setPendingCategory] = useState<ArticleCategory | null>(
    (searchParams.get('type') as ArticleCategory | null) ?? null,
  );
  const [pendingEntityType, setPendingEntityType] = useState<ArticleLinkedEntityType | null>(null);

  if (!world || !worldId) return null;
  if (!isNew && !existing) return <Navigate to={`/w/${worldId}/manager`} replace />;

  const folder = existing ? worldFolders.find((f) => f.id === existing.folderId) : undefined;

  if (isNew && !pendingCategory && !pendingEntityType) {
    return (
      <SectionLayout worldId={world.id}>
        <ArticleTypePicker
          onPick={setPendingCategory}
          onPickEntity={setPendingEntityType}
          worldId={world.id}
          campaignId={primaryCampaign?.id}
        />
      </SectionLayout>
    );
  }

  if (isNew && pendingEntityType) {
    const backToManager = () => navigate(`/w/${world.id}/manager`);
    const afterSave = (articleOutcome?: { createdArticleId: string } | null) =>
      navigate(articleOutcome ? `/w/${world.id}/manager/entry/${articleOutcome.createdArticleId}` : `/w/${world.id}/manager`);

    if (!primaryCampaign) {
      return (
        <SectionLayout worldId={world.id}>
          <ComingSoon
            icon={<FolderIcon sx={{ fontSize: 56 }} />}
            title="No campaign yet"
            description="NPCs, Creatures, Spells, and Magic items are tracked per-campaign. Create a campaign in this world first, then come back to link an article to one."
          />
          <Button sx={{ mt: 2 }} onClick={() => setPendingEntityType(null)}>
            Back
          </Button>
        </SectionLayout>
      );
    }

    return (
      <SectionLayout worldId={world.id}>
        {pendingEntityType === 'npc' && (
          <NpcFormDialog
            open
            onClose={backToManager}
            campaignId={primaryCampaign.id}
            worldId={world.id}
            onSubmit={(creature, articleOutcome) => {
              addCreatureToCampaign(primaryCampaign.id, creature);
              afterSave(articleOutcome);
            }}
          />
        )}
        {pendingEntityType === 'creature' && (
          <CreatureFormDialog
            open
            onClose={backToManager}
            worldId={world.id}
            onSubmit={(creature, articleOutcome) => {
              addCreatureToCampaign(primaryCampaign.id, creature);
              afterSave(articleOutcome);
            }}
          />
        )}
        {pendingEntityType === 'spell' && (
          <SpellFormDialog
            open
            onClose={backToManager}
            worldId={world.id}
            onSubmit={(spell, articleOutcome) => {
              addSpellToCampaign(primaryCampaign.id, spell);
              afterSave(articleOutcome);
            }}
          />
        )}
        {pendingEntityType === 'item' && (
          <MagicItemFormDialog
            open
            onClose={backToManager}
            worldId={world.id}
            onSubmit={(item, articleOutcome) => {
              addMagicItemToCampaign(primaryCampaign.id, item);
              afterSave(articleOutcome);
            }}
          />
        )}
        {pendingEntityType === 'faction' && (
          <FactionFormDialog
            open
            onClose={backToManager}
            campaignId={primaryCampaign.id}
            worldId={world.id}
            onSubmit={(faction, articleOutcome) => {
              addFactionToCampaign(primaryCampaign.id, faction);
              afterSave(articleOutcome);
            }}
          />
        )}
        {pendingEntityType === 'quest' && (
          <QuestFormDialog
            open
            onClose={backToManager}
            factions={getFactionsForCampaign(factionsByCampaignId, primaryCampaign.id)}
            worldId={world.id}
            onSubmit={(quest, articleOutcome) => {
              addQuestToCampaign(primaryCampaign.id, quest);
              afterSave(articleOutcome);
            }}
          />
        )}
        {pendingEntityType === 'bastion' && (
          <BastionFormDialog
            open
            onClose={backToManager}
            worldId={world.id}
            onSubmit={(bastion, articleOutcome) => {
              addBastionToCampaign(primaryCampaign.id, bastion);
              afterSave(articleOutcome);
            }}
          />
        )}
      </SectionLayout>
    );
  }

  if (mode === 'edit') {
    const category = pendingCategory ?? existing!.category;
    return (
      <SectionLayout worldId={world.id}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
          {backHref && (
            <IconButton size="small" onClick={() => navigate(backHref)} sx={{ mt: 0.25 }}>
              <ArrowBackIcon fontSize="small" />
            </IconButton>
          )}
          <Box sx={{ flexGrow: 1 }}>
            <Breadcrumbs
              items={[
                { label: world.name, to: `/w/${world.id}/home` },
                { label: 'World Manager', to: `/w/${world.id}/manager` },
                ...(fromLabel && backHref ? [{ label: fromLabel, to: backHref }] : []),
                { label: isNew ? `New ${ARTICLE_TEMPLATES[category].label}` : existing!.name },
              ]}
            />
          </Box>
        </Stack>
        <ArticleForm
          worldId={world.id}
          category={category}
          folders={worldFolders}
          initialArticle={existing}
          onCancel={() => (isNew ? navigate(`/w/${world.id}/manager`) : setMode('view'))}
          onSubmit={(article) => {
            if (isNew) {
              addArticle(article);
              navigate(`/w/${world.id}/manager/entry/${article.id}`);
            } else {
              updateArticle(article.id, article);
              setMode('view');
            }
          }}
        />
      </SectionLayout>
    );
  }

  const article = existing!;
  const template = ARTICLE_TEMPLATES[article.category];

  return (
    <SectionLayout
      worldId={world.id}
      right={
        <Stack spacing={2}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Folder
            </Typography>
            <Typography variant="body2">{folder?.name ?? '(none)'}</Typography>
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Tags
            </Typography>
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
              {article.tags.length > 0 ? (
                article.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No tags
                </Typography>
              )}
            </Stack>
          </Box>
          <Box>
            <Typography variant="overline" color="text.secondary">
              Linked
            </Typography>
            <Typography variant="body2" color="text.secondary">
              No linked articles yet
            </Typography>
          </Box>
        </Stack>
      }
    >
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        {backHref && (
          <IconButton size="small" onClick={() => navigate(backHref)} sx={{ mt: 0.25 }}>
            <ArrowBackIcon fontSize="small" />
          </IconButton>
        )}
        <Box sx={{ flexGrow: 1 }}>
          <Breadcrumbs
            items={[
              { label: world.name, to: `/w/${world.id}/home` },
              { label: 'World Manager', to: `/w/${world.id}/manager` },
              ...(fromLabel && backHref
                ? [{ label: fromLabel, to: backHref }]
                : folder
                  ? [{ label: folder.name }]
                  : []),
              { label: article.name },
            ]}
          />
        </Box>
      </Stack>

      <ArticleContentView
        article={article}
        template={template}
        headerActions={
          <Button size="small" variant="outlined" startIcon={<EditIcon />} onClick={() => setMode('edit')}>
            Edit
          </Button>
        }
      />
    </SectionLayout>
  );
}

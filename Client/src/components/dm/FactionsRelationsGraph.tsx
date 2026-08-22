import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Collapse from '@mui/material/Collapse';
import Popover from '@mui/material/Popover';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import PublicIcon from '@mui/icons-material/Public';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { TokenThumbnail } from '../map/TokenThumbnail';
import { FactionFormDialog } from './FactionFormDialog';
import { FactionRelationDialog } from './FactionRelationDialog';
import { FactionDetailPanel } from './FactionDetailPanel';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import {
  useFactionStore,
  getFactionsForCampaign,
  getFactionRelationsForCampaign,
} from '../../store/useFactionStore';
import { RELATION_TYPE_META, RELATION_TYPES, findRelation } from '../../types/factionRelation';
import { getFactionInfluenceOption, type Faction, type FactionInfluence } from '../../types/faction';

interface FactionsRelationsGraphProps {
  campaignId: string;
  search: string;
  /** Which influence/power tiers to show for non-center factions; center is always shown. */
  influenceFilter: FactionInfluence[];
}

const CANVAS_SIZE = 680;
const CENTER = CANVAS_SIZE / 2;
/** Secondary (outer) ring - farther from center, thinner connector. */
const OUTER_RING_RADIUS = 260;
/** Primary (inner) ring - closer to center, thicker connector. */
const INNER_RING_RADIUS = 160;
const CENTER_NODE_SIZE = 112;

export function FactionsRelationsGraph({ campaignId, search, influenceFilter }: FactionsRelationsGraphProps) {
  const theme = useTheme();
  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const relationsByCampaignId = useFactionStore((s) => s.relationsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const fetchRelationsForCampaign = useFactionStore((s) => s.fetchRelationsForCampaign);
  const addFactionToCampaign = useFactionStore((s) => s.addFactionToCampaign);
  const updateFactionInCampaign = useFactionStore((s) => s.updateFactionInCampaign);
  const deleteFactionFromCampaign = useFactionStore((s) => s.deleteFactionFromCampaign);
  const addRelation = useFactionStore((s) => s.addRelation);
  const updateRelation = useFactionStore((s) => s.updateRelation);
  const deleteRelation = useFactionStore((s) => s.deleteRelation);

  const factions = getFactionsForCampaign(factionsByCampaignId, campaignId);
  const relations = getFactionRelationsForCampaign(relationsByCampaignId, campaignId);

  useEffect(() => {
    fetchFactionsForCampaign(campaignId);
    fetchRelationsForCampaign(campaignId);
  }, [campaignId, fetchFactionsForCampaign, fetchRelationsForCampaign]);

  const [centerId, setCenterId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFaction, setEditingFaction] = useState<Faction | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<Faction | null>(null);
  const [relationDialogOpen, setRelationDialogOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const [legendAnchorEl, setLegendAnchorEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!centerId && factions.length > 0) setCenterId(factions[0].id);
    if (centerId && !factions.some((f) => f.id === centerId)) setCenterId(factions[0]?.id ?? null);
  }, [factions, centerId]);

  const query = search.trim().toLowerCase();
  const matchesSearch = (f: Faction) => !query || f.name.toLowerCase().includes(query);

  const center = factions.find((f) => f.id === centerId);
  const ring = useMemo(
    () =>
      factions.filter(
        (f) =>
          f.id !== centerId &&
          centerId &&
          f.influence !== 'petty' &&
          influenceFilter.includes(f.influence) &&
          findRelation(relations, centerId, f.id),
      ),
    [factions, centerId, relations, influenceFilter],
  );

  const selected = factions.find((f) => f.id === selectedId);
  const activeRelation = center && selected ? findRelation(relations, center.id, selected.id) : undefined;

  const positions = useMemo(() => {
    const map = new Map<string, { x: number; y: number }>();
    if (!centerId) return map;
    const primaryRing = ring.filter((f) => findRelation(relations, centerId, f.id)?.importance === 'primary');
    const secondaryRing = ring.filter((f) => findRelation(relations, centerId, f.id)?.importance !== 'primary');
    [
      // Secondary ring is offset by half its own step so its spokes fall
      // between the primary ring's spokes instead of lining up with them
      // (which made the two rings' connector lines look like one overlapping line).
      { members: primaryRing, radius: INNER_RING_RADIUS, angleOffset: 0 },
      { members: secondaryRing, radius: OUTER_RING_RADIUS, angleOffset: 0.5 },
    ].forEach(({ members, radius, angleOffset }) => {
      const step = (2 * Math.PI) / Math.max(1, members.length);
      members.forEach((f, i) => {
        const angle = -Math.PI / 2 + (i + angleOffset) * step;
        map.set(f.id, {
          x: CENTER + radius * Math.cos(angle),
          y: CENTER + radius * Math.sin(angle),
        });
      });
    });
    return map;
  }, [ring, centerId, relations]);

  if (factions.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 8, px: 3, borderRadius: 4, border: '1px dashed', borderColor: 'divider' }}>
        <PublicIcon sx={{ fontSize: 56, mb: 1, color: 'text.disabled' }} />
        <Typography variant="h6" sx={{ mb: 0.5 }}>
          No factions yet
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Add factions to build out the diplomatic map.
        </Typography>
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
          onSubmit={(faction) => {
            addFactionToCampaign(campaignId, faction);
            setDialogOpen(false);
          }}
        />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: 'center' }}>
        <Tooltip title={actionsOpen ? 'Hide actions' : 'Show actions'}>
          <IconButton size="small" onClick={() => setActionsOpen((v) => !v)}>
            <TuneIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Collapse in={actionsOpen} orientation="horizontal">
          <Stack direction="row" spacing={1}>
            <Button
              size="small"
              variant="outlined"
              startIcon={<AddIcon />}
              onClick={() => {
                setEditingFaction(undefined);
                setDialogOpen(true);
              }}
            >
              Add Faction
            </Button>
            {center && (
              <>
                <Tooltip title="Edit center faction">
                  <IconButton
                    size="small"
                    onClick={() => {
                      setEditingFaction(center);
                      setDialogOpen(true);
                    }}
                  >
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete center faction">
                  <IconButton size="small" onClick={() => setDeleteTarget(center)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
          </Stack>
        </Collapse>
      </Stack>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Paper
          elevation={3}
          sx={{
            position: 'relative',
            width: '100%',
            maxWidth: CANVAS_SIZE,
            aspectRatio: '1 / 1',
            mx: 'auto',
            borderRadius: '50%',
            bgcolor: 'background.paper',
            backgroundImage: (theme) =>
              `radial-gradient(circle at center, ${theme.palette.action.hover} 0%, transparent 70%)`,
            border: '1px solid',
            borderColor: 'divider',
            overflow: 'visible',
          }}
        >
          <Tooltip title="Legend">
            <IconButton
              size="small"
              onClick={(e) => setLegendAnchorEl(e.currentTarget)}
              sx={{
                position: 'absolute',
                top: 4,
                right: 4,
                zIndex: 1,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <InfoOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Popover
            open={Boolean(legendAnchorEl)}
            anchorEl={legendAnchorEl}
            onClose={() => setLegendAnchorEl(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
          >
            <Box sx={{ p: 2, minWidth: 180 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.4 }}>
                LEGEND
              </Typography>
              <Stack spacing={0.75} sx={{ mt: 1 }}>
                {RELATION_TYPES.map((t) => (
                  <Stack key={t} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 20, height: 3, borderRadius: 2, bgcolor: RELATION_TYPE_META[t].color }} />
                    <Typography variant="caption">{RELATION_TYPE_META[t].label}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Popover>
          <Box sx={{ position: 'absolute', inset: 0 }}>
            <svg viewBox={`0 0 ${CANVAS_SIZE} ${CANVAS_SIZE}`} width="100%" height="100%" style={{ position: 'absolute', inset: 0 }}>
              {[INNER_RING_RADIUS, OUTER_RING_RADIUS].map((r) => (
                <circle
                  key={r}
                  cx={CENTER}
                  cy={CENTER}
                  r={r}
                  fill="none"
                  stroke={theme.palette.divider}
                  strokeDasharray="4 6"
                />
              ))}
              {center &&
                ring.map((f) => {
                  const pos = positions.get(f.id);
                  if (!pos) return null;
                  const relation = findRelation(relations, center.id, f.id);
                  const meta = relation ? RELATION_TYPE_META[relation.type] : RELATION_TYPE_META.neutral;
                  const dimmed = !matchesSearch(f) && query.length > 0;
                  const strength = relation?.strength ?? 20;
                  // Importance sets the tier (primary = thick, secondary = thin); strength still
                  // varies weight within that tier.
                  const strokeWidth =
                    relation?.importance === 'primary' ? 3 + (strength / 100) * 2 : 1 + (strength / 100) * 1;
                  return (
                    <line
                      key={f.id}
                      x1={CENTER}
                      y1={CENTER}
                      x2={pos.x}
                      y2={pos.y}
                      stroke={meta.color}
                      strokeWidth={strokeWidth}
                      strokeOpacity={dimmed ? 0.15 : 0.85}
                    />
                  );
                })}
            </svg>
          </Box>

          {center && (
            <Tooltip title={center.name}>
              <Box
                onClick={() => setSelectedId(null)}
                sx={{
                  position: 'absolute',
                  left: CENTER - CENTER_NODE_SIZE / 2,
                  top: CENTER - CENTER_NODE_SIZE / 2,
                  width: CENTER_NODE_SIZE,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <TokenThumbnail
                  src={center.imageSrc}
                  name={center.name}
                  size={CENTER_NODE_SIZE}
                  border="3px solid"
                  sx={{
                    borderColor: 'primary.main',
                    boxShadow: (theme) => `0 0 0 6px ${theme.palette.background.paper}, 0 0 24px ${theme.palette.primary.main}55`,
                  }}
                />
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5, fontWeight: 700, lineHeight: 1.2 }}
                >
                  {center.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Power {center.powerLabel || center.power}
                </Typography>
              </Box>
            </Tooltip>
          )}

          {ring.map((f) => {
            const pos = positions.get(f.id);
            if (!pos) return null;
            const relation = center ? findRelation(relations, center.id, f.id) : undefined;
            const meta = relation ? RELATION_TYPE_META[relation.type] : RELATION_TYPE_META.neutral;
            const dimmed = !matchesSearch(f) && query.length > 0;
            const isSelected = f.id === selectedId;
            const nodeSize = getFactionInfluenceOption(f.influence).ringNodeSize;
            return (
              <Tooltip key={f.id} title="Click for details · Double-click to focus">
                <Box
                  onClick={() => setSelectedId((cur) => (cur === f.id ? null : f.id))}
                  onDoubleClick={() => {
                    setCenterId(f.id);
                    setSelectedId(null);
                  }}
                  sx={{
                    position: 'absolute',
                    left: pos.x - nodeSize / 2,
                    top: pos.y - nodeSize / 2,
                    width: nodeSize,
                    cursor: 'pointer',
                    textAlign: 'center',
                    opacity: dimmed ? 0.35 : 1,
                    transition: 'opacity 160ms ease, transform 160ms ease',
                    transform: isSelected ? 'scale(1.08)' : 'scale(1)',
                  }}
                >
                  <TokenThumbnail
                    src={f.imageSrc}
                    name={f.name}
                    size={nodeSize}
                    border={`3px solid ${meta.color}`}
                    sx={isSelected ? { boxShadow: (theme) => `0 0 0 4px ${theme.palette.background.paper}` } : undefined}
                  />
                  <Typography variant="caption" sx={{ display: 'block', mt: 0.5, lineHeight: 1.15 }} noWrap>
                    {f.name}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Paper>

        <Stack spacing={2} sx={{ width: { xs: '100%', md: 300 }, flexShrink: 0 }}>
          {center && selected && (
            <FactionDetailPanel
              center={center}
              selected={selected}
              relation={activeRelation}
              onClose={() => setSelectedId(null)}
              onEditRelation={() => setRelationDialogOpen(true)}
            />
          )}
        </Stack>
      </Stack>

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
        onSubmit={(faction) => {
          if (editingFaction) updateFactionInCampaign(campaignId, faction);
          else addFactionToCampaign(campaignId, faction);
          setDialogOpen(false);
          setEditingFaction(undefined);
        }}
      />

      {center && selected && (
        <FactionRelationDialog
          open={relationDialogOpen}
          onClose={() => setRelationDialogOpen(false)}
          factions={factions}
          campaignId={campaignId}
          factionAId={center.id}
          factionBId={selected.id}
          initialRelation={activeRelation}
          onDelete={
            activeRelation
              ? () => {
                  deleteRelation(campaignId, activeRelation.id);
                  setRelationDialogOpen(false);
                }
              : undefined
          }
          onSubmit={(relation) => {
            if (activeRelation) updateRelation(relation);
            else addRelation(relation);
            setRelationDialogOpen(false);
          }}
        />
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="faction"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteFactionFromCampaign(campaignId, deleteTarget.id);
            if (deleteTarget.id === selectedId) setSelectedId(null);
          }
          setDeleteTarget(null);
        }}
      />
    </Box>
  );
}

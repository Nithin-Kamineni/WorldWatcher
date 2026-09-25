import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** Asks the parent to open the read-only faction card for this faction. The card itself
   * lives in FactionsSection so the table and the graph share one instance (and one
   * article-link builder) rather than each owning a copy. */
  onViewFactionCard?: (faction: Faction) => void;
}

/** The coordinate system the whole graph is authored in. Ring radii, node diameters, label
 * sizes and connector gaps are all expressed against this and then multiplied by the live
 * `scale` below, so the picture keeps its proportions at any width.
 *
 * It used to be only HALF that way, and that was the bug: the rings are an SVG `viewBox`,
 * which rescales itself to whatever the Paper ends up being, while the nodes were
 * absolutely-positioned HTML at FIXED px. A normal window (icon rail + world sidebar + the
 * 300px detail panel) leaves this about 400px, so the rings drew at 59% while the portraits
 * stayed at 100% - the centre node swallowed its own label, ring nodes crowded the middle,
 * and names collided. Both halves now read the same scale.
 *
 * The scale is *measured and multiplied in*, never applied as a CSS `transform`/`zoom`, for
 * the same reason `theme/uiScale.ts` gives: MUI positions Tooltips and Popovers from real
 * rects and does not compensate for a scaled ancestor. */
const CANVAS_SIZE = 680;
const CENTER = CANVAS_SIZE / 2;
/** Secondary (outer) ring - farther from center, thinner connector. */
const OUTER_RING_RADIUS = 260;
/** Primary (inner) ring - closer to center, thicker connector. */
const INNER_RING_RADIUS = 160;
const CENTER_NODE_SIZE = 112;
/** Gap (in canvas units) left between a connector's end and the portrait it points at, so
 * lines stop at the rim instead of running underneath the artwork. */
const CONNECTOR_GAP = 6;
/** Label type sizes in canvas units, and the floor they are never allowed to fall below -
 * a proportionally-correct 6px name is still an unreadable one. */
const RING_LABEL_SIZE = 13;
const CENTER_LABEL_SIZE = 15;
const MIN_LABEL_PX = 10;

export function FactionsRelationsGraph({ campaignId, search, influenceFilter, onViewFactionCard }: FactionsRelationsGraphProps) {
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

  /** Live width of the round canvas, and the factor every authored size is multiplied by.
   * Starts at the authored size so the first paint is proportionate even before the
   * observer fires. A callback ref rather than `useRef` + `useEffect([])`: the canvas is not
   * in the tree on the first render (the "no factions yet" branch returns before it), so an
   * effect keyed on `[]` would observe nothing and never run again. */
  const observerRef = useRef<ResizeObserver | null>(null);
  const [canvasWidth, setCanvasWidth] = useState(CANVAS_SIZE);
  const canvasRef = useCallback((el: HTMLDivElement | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width > 0) setCanvasWidth(width);
    });
    observer.observe(el);
    observerRef.current = observer;
  }, []);
  const scale = canvasWidth / CANVAS_SIZE;
  /** Authored canvas units -> real px. */
  const cu = (n: number) => n * scale;
  const labelPx = (n: number) => Math.max(MIN_LABEL_PX, Math.round(n * scale));

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

      {/* Centred rather than left-hugging: the canvas has a hard 680px cap, so on a wide
        * content area it otherwise sits in the corner of a large empty rectangle. */}
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={3}
        sx={{ alignItems: { xs: 'center', lg: 'flex-start' }, justifyContent: 'center' }}
      >
        <Paper
          ref={canvasRef}
          elevation={3}
          sx={{
            position: 'relative',
            /* Capped by the viewport as well as by the column, because a circle that runs off
             * the bottom of the window is the other way this reads as broken. */
            width: `min(100%, ${CANVAS_SIZE}px, 68vh)`,
            aspectRatio: '1 / 1',
            flexShrink: 0,
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
                  // Trim both ends back to the rim of the portrait they touch. Drawn centre-to-
                  // centre the line runs under the artwork, which at a small canvas reads as a
                  // stray line poking out of a circle.
                  const dx = pos.x - CENTER;
                  const dy = pos.y - CENTER;
                  const dist = Math.hypot(dx, dy) || 1;
                  const ux = dx / dist;
                  const uy = dy / dist;
                  const fromCenter = CENTER_NODE_SIZE / 2 + CONNECTOR_GAP;
                  const toNode = getFactionInfluenceOption(f.influence).ringNodeSize / 2 + CONNECTOR_GAP;
                  return (
                    <line
                      key={f.id}
                      x1={CENTER + ux * fromCenter}
                      y1={CENTER + uy * fromCenter}
                      x2={pos.x - ux * toNode}
                      y2={pos.y - uy * toNode}
                      stroke={meta.color}
                      strokeWidth={strokeWidth}
                      strokeLinecap="round"
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
                  left: '50%',
                  top: '50%',
                  // Only the PORTRAIT is centred on the hub; the label hangs below it. Centring
                  // the portrait+label block instead (what this used to do) pushed the artwork
                  // above the hub and dropped the name straight onto the inner ring.
                  transform: `translate(-50%, -${cu(CENTER_NODE_SIZE) / 2}px)`,
                  // 1.6x the portrait, not wider: a long name on one line ("Confederacy of
                  // Independent Kingdoms" measures 240px) reaches past the inner ring and
                  // crosses the nodes sitting at the lower diagonals. Wrapping it keeps it
                  // inside the gap between the hub and that ring.
                  width: cu(CENTER_NODE_SIZE * 1.6),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                <TokenThumbnail
                  src={center.imageSrc}
                  name={center.name}
                  size={cu(CENTER_NODE_SIZE)}
                  border={`${Math.max(2, cu(3))}px solid`}
                  sx={{
                    borderColor: 'primary.main',
                    boxShadow: (theme) =>
                      `0 0 0 ${Math.max(3, cu(6))}px ${theme.palette.background.paper}, 0 0 ${Math.max(
                        8,
                        cu(24),
                      )}px ${theme.palette.primary.main}55`,
                  }}
                />
                <Typography
                  sx={{
                    mt: `${Math.max(4, cu(8))}px`,
                    fontSize: `${labelPx(CENTER_LABEL_SIZE)}px`,
                    fontWeight: 700,
                    lineHeight: 1.25,
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                    overflow: 'hidden',
                    textShadow: (theme) => `0 1px 3px ${theme.palette.background.default}`,
                  }}
                >
                  {center.name}
                </Typography>
                <Typography
                  color="text.secondary"
                  sx={{
                    fontSize: `${labelPx(RING_LABEL_SIZE)}px`,
                    lineHeight: 1.25,
                    textShadow: (theme) => `0 1px 3px ${theme.palette.background.default}`,
                  }}
                >
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
            const nodeSize = cu(getFactionInfluenceOption(f.influence).ringNodeSize);
            return (
              <Tooltip key={f.id} title={`${f.name} · click for details, double-click to focus`}>
                <Box
                  onClick={() => setSelectedId((cur) => (cur === f.id ? null : f.id))}
                  onDoubleClick={() => {
                    setCenterId(f.id);
                    setSelectedId(null);
                  }}
                  sx={{
                    position: 'absolute',
                    left: `${(pos.x / CANVAS_SIZE) * 100}%`,
                    top: `${(pos.y / CANVAS_SIZE) * 100}%`,
                    // As with the hub: the portrait sits on the ring point, the name hangs below.
                    transform: `translate(-50%, -${nodeSize / 2}px)`,
                    // Names get a box wider than their portrait so they wrap to two lines
                    // instead of being cut to "Independent dragon…".
                    width: Math.max(nodeSize * 2.2, cu(110)),
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    cursor: 'pointer',
                    textAlign: 'center',
                    opacity: dimmed ? 0.35 : 1,
                    transition: 'opacity 160ms ease',
                  }}
                >
                  <TokenThumbnail
                    src={f.imageSrc}
                    name={f.name}
                    size={nodeSize}
                    border={`${Math.max(2, cu(3))}px solid ${meta.color}`}
                    sx={{
                      transition: 'transform 160ms ease, box-shadow 160ms ease',
                      transform: isSelected ? 'scale(1.1)' : 'none',
                      boxShadow: (theme) =>
                        isSelected
                          ? `0 0 0 ${Math.max(2, cu(4))}px ${theme.palette.background.paper}, 0 0 ${Math.max(
                              6,
                              cu(18),
                            )}px ${meta.color}88`
                          : `0 0 0 ${Math.max(2, cu(4))}px ${theme.palette.background.paper}`,
                    }}
                  />
                  <Typography
                    sx={{
                      mt: `${Math.max(3, cu(6))}px`,
                      fontSize: `${labelPx(RING_LABEL_SIZE)}px`,
                      fontWeight: isSelected ? 700 : 500,
                      lineHeight: 1.2,
                      display: '-webkit-box',
                      WebkitBoxOrient: 'vertical',
                      WebkitLineClamp: 2,
                      overflow: 'hidden',
                      textShadow: (theme) => `0 1px 3px ${theme.palette.background.default}`,
                    }}
                  >
                    {f.name}
                  </Typography>
                </Box>
              </Tooltip>
            );
          })}
        </Paper>

        {/* Rendered only when something is selected. A column that was always mounted held
          * its 300px whether or not it had anything in it, which is most of what squeezed the
          * canvas down to the size that exposed the scale bug above. */}
        {center && selected && (
          <Stack spacing={2} sx={{ width: { xs: '100%', lg: 320 }, maxWidth: 360, flexShrink: 0 }}>
            <FactionDetailPanel
              center={center}
              selected={selected}
              relation={activeRelation}
              onClose={() => setSelectedId(null)}
              onEditRelation={() => setRelationDialogOpen(true)}
              onViewCard={onViewFactionCard ? () => onViewFactionCard(selected) : undefined}
            />
          </Stack>
        )}
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

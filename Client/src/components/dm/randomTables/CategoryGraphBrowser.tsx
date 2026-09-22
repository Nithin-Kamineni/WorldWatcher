import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import RemoveIcon from '@mui/icons-material/Remove';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import CenterFocusStrongIcon from '@mui/icons-material/CenterFocusStrong';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import SwapVertIcon from '@mui/icons-material/SwapVert';
import { useCategoryStore } from '../../../store/useCategoryStore';
import { ConfirmDeleteDialog } from '../ConfirmDeleteDialog';
import { categoryIconFor } from './CategoryIcon';
import type { CategoryNode } from '../../../types/category';

const ROOT_ID = '__all_categories__';
const NODE_WIDTH = 252;
const NODE_HEIGHT = 88;
const X_GAP = 324;
const Y_GAP = 120;
const GRAPH_TOP_GUTTER = 176;

interface GraphItem {
  id: string;
  node: CategoryNode | null;
  children: GraphItem[];
}

interface PositionedItem extends GraphItem {
  x: number;
  y: number;
  depth: number;
}

interface CategoryGraphBrowserProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  counts?: Map<string, number>;
  onCreateAt?: (categoryId: string | null) => void;
  itemLabel?: string;
  overlay?: ReactNode;
  secondaryAction?: ReactNode;
}

function slugify(name: string): string {
  const base = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  return base || `category-${Math.random().toString(36).slice(2, 8)}`;
}

function descendants(node: CategoryNode): string[] {
  return node.children.flatMap((child) => [child.id, ...descendants(child)]);
}

/** A functional node-and-edge category map. Branches open in-place, user nodes can be
 * dragged to a new parent, and every node exposes the create-child/create-content actions. */
export function CategoryGraphBrowser({ selectedId, onSelect, counts = new Map(), onCreateAt, itemLabel = 'table', overlay, secondaryAction }: CategoryGraphBrowserProps) {
  const theme = useTheme();
  const tree = useCategoryStore((s) => s.tree);
  const fetchTree = useCategoryStore((s) => s.fetchTree);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const moveCategory = useCategoryStore((s) => s.moveCategory);
  const removeCategory = useCategoryStore((s) => s.removeCategory);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([ROOT_ID]));
  const [zoom, setZoom] = useState(0.9);
  const [orientation, setOrientation] = useState<'horizontal' | 'vertical'>('horizontal');
  const [addParent, setAddParent] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => { fetchTree(); }, [fetchTree]);

  const graph = useMemo<GraphItem>(() => {
    const build = (node: CategoryNode): GraphItem => ({
      id: node.id,
      node,
      children: expanded.has(node.id) ? node.children.map(build) : [],
    });
    return { id: ROOT_ID, node: null, children: expanded.has(ROOT_ID) ? tree.map(build) : [] };
  }, [tree, expanded]);

  const { positions, edges, width, height } = useMemo(() => {
    const placed: PositionedItem[] = [];
    const links: { from: string; to: string }[] = [];
    let leaf = 0;
    let maxDepth = 0;
    const walk = (item: GraphItem, depth: number): number => {
      maxDepth = Math.max(maxDepth, depth);
      const childYs = item.children.map((child) => {
        links.push({ from: item.id, to: child.id });
        return walk(child, depth + 1);
      });
      const crossAxis = childYs.length > 0 ? childYs.reduce((sum, value) => sum + value, 0) / childYs.length : leaf++ * (orientation === 'horizontal' ? Y_GAP : X_GAP) + (orientation === 'horizontal' ? GRAPH_TOP_GUTTER : 42);
      placed.push({
        ...item,
        x: orientation === 'horizontal' ? depth * X_GAP + 42 : crossAxis,
        y: orientation === 'horizontal' ? crossAxis : depth * Y_GAP + GRAPH_TOP_GUTTER,
        depth,
      });
      return crossAxis;
    };
    walk(graph, 0);
    return {
      positions: placed,
      edges: links,
      width: orientation === 'horizontal'
        ? Math.max(920, (maxDepth + 1) * X_GAP + 90)
        : Math.max(920, leaf * X_GAP + 90),
      height: orientation === 'horizontal'
        ? Math.max(650, leaf * Y_GAP + GRAPH_TOP_GUTTER + 60)
        : Math.max(650, (maxDepth + 1) * Y_GAP + GRAPH_TOP_GUTTER + 60),
    };
  }, [graph, orientation]);

  const centerGraph = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    viewport.scrollTo({
      left: Math.max(0, (width * zoom - viewport.clientWidth) / 2),
      top: Math.max(0, (height * zoom - viewport.clientHeight) / 2 - 54),
      behavior: 'smooth',
    });
  };

  const byId = useMemo(() => new Map(positions.map((item) => [item.id, item])), [positions]);
  const allNodes = useMemo(() => {
    const map = new Map<string, CategoryNode>();
    const walk = (node: CategoryNode) => { map.set(node.id, node); node.children.forEach(walk); };
    tree.forEach(walk);
    return map;
  }, [tree]);

  const toggle = (id: string) => setExpanded((current) => {
    const next = new Set(current);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const submitCategory = async () => {
    const name = newName.trim();
    if (!name || addParent === undefined) return;
    const created = await addCategory({ name, slug: slugify(name), parentId: addParent });
    setAddParent(undefined);
    setNewName('');
    if (created) {
      if (created.parentId) setExpanded((current) => new Set(current).add(created.parentId!));
      onSelect(created.id);
    }
  };

  const handleDrop = async (targetId: string, draggedId: string) => {
    setDragOverId(null);
    const dragged = allNodes.get(draggedId);
    if (!dragged || dragged.isSystem || draggedId === targetId) return;
    if (targetId !== ROOT_ID && descendants(dragged).includes(targetId)) return;
    await moveCategory(draggedId, targetId === ROOT_ID ? null : targetId);
    if (targetId !== ROOT_ID) setExpanded((current) => new Set(current).add(targetId));
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        position: 'relative',
        width: '100%',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 4,
        bgcolor: 'background.paper',
        backgroundImage: (t) =>
          `radial-gradient(circle, ${t.palette.divider} 1px, transparent 1px), linear-gradient(135deg, ${t.palette.primary.main}0b, transparent 45%)`,
        backgroundSize: '24px 24px, 100% 100%',
      }}
    >
      {overlay && (
        <Box sx={{ position: 'absolute', top: 16, left: 18, right: { xs: 18, lg: 360 }, zIndex: 8 }}>
          {overlay}
        </Box>
      )}

      <Stack
        direction="row"
        spacing={1}
        sx={{
          position: 'absolute', top: { xs: 176, md: 112, lg: 16 }, right: 18, zIndex: 9,
          alignItems: 'center', pointerEvents: 'none',
        }}
      >
        <Paper elevation={2} sx={{ p: 0.5, borderRadius: 2.5, pointerEvents: 'auto' }}>
          <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
            <Tooltip title={`Switch to ${orientation === 'horizontal' ? 'top-to-bottom' : 'left-to-right'} layout`}>
              <IconButton size="small" onClick={() => setOrientation((value) => value === 'horizontal' ? 'vertical' : 'horizontal')}>
                {orientation === 'horizontal' ? <SwapVertIcon fontSize="small" /> : <SwapHorizIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
            <Tooltip title="Zoom out"><span><IconButton size="small" aria-label="Zoom out" disabled={zoom <= 0.6} onClick={() => setZoom((value) => Math.max(0.6, value - 0.1))}><RemoveIcon fontSize="small" /></IconButton></span></Tooltip>
            <Typography variant="caption" sx={{ minWidth: 42, textAlign: 'center', fontWeight: 700 }}>{Math.round(zoom * 100)}%</Typography>
            <Tooltip title="Zoom in"><span><IconButton size="small" aria-label="Zoom in" disabled={zoom >= 1.25} onClick={() => setZoom((value) => Math.min(1.25, value + 0.1))}><AddIcon fontSize="small" /></IconButton></span></Tooltip>
            <Tooltip title="Center whole graph"><IconButton size="small" aria-label="Center whole graph" onClick={centerGraph}><CenterFocusStrongIcon fontSize="small" /></IconButton></Tooltip>
            <Tooltip title="Reset graph"><IconButton size="small" onClick={() => { setZoom(0.9); setExpanded(new Set([ROOT_ID])); setTimeout(centerGraph, 0); }}><RestartAltIcon fontSize="small" /></IconButton></Tooltip>
          </Stack>
        </Paper>
      </Stack>

      <Box ref={viewportRef} sx={{ position: 'absolute', inset: 0, overflow: 'auto', pt: overlay ? { xs: 24, md: 17, lg: 13 } : 9 }}>
        <Box sx={{ position: 'relative', width: width * zoom, height: height * zoom, minWidth: '100%', minHeight: '100%' }}>
          <Box sx={{ position: 'absolute', inset: 0, width, height, transform: `scale(${zoom})`, transformOrigin: '0 0' }}>
            <svg width={width} height={height} style={{ position: 'absolute', inset: 0, overflow: 'visible' }} aria-hidden="true">
              {edges.map((edge) => {
                const from = byId.get(edge.from);
                const to = byId.get(edge.to);
                if (!from || !to) return null;
                const x1 = orientation === 'horizontal' ? from.x + NODE_WIDTH : from.x + NODE_WIDTH / 2;
                const y1 = orientation === 'horizontal' ? from.y + NODE_HEIGHT / 2 : from.y + NODE_HEIGHT;
                const x2 = orientation === 'horizontal' ? to.x : to.x + NODE_WIDTH / 2;
                const y2 = orientation === 'horizontal' ? to.y + NODE_HEIGHT / 2 : to.y;
                const mid = orientation === 'horizontal' ? (x1 + x2) / 2 : (y1 + y2) / 2;
                const active = selectedId === from.id || selectedId === to.id;
                return (
                  <path
                    key={`${edge.from}-${edge.to}`}
                    d={orientation === 'horizontal'
                      ? `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`
                      : `M ${x1} ${y1} C ${x1} ${mid}, ${x2} ${mid}, ${x2} ${y2}`}
                    fill="none"
                    stroke={active ? theme.palette.primary.main : theme.palette.divider}
                    strokeWidth={active ? 3 : 2}
                    strokeOpacity={active ? 0.95 : 0.8}
                  />
                );
              })}
            </svg>

            {positions.map((item) => {
              const isRoot = item.id === ROOT_ID;
              const node = item.node;
              const isSelected = isRoot ? selectedId === null : selectedId === item.id;
              const hasChildren = isRoot ? tree.length > 0 : (node?.children.length ?? 0) > 0;
              const isExpanded = expanded.has(item.id);
              const count = isRoot ? tree.reduce((sum, root) => sum + (counts.get(root.id) ?? 0), 0) : (counts.get(item.id) ?? 0);
              const canDrag = !!node && !node.isSystem;
              return (
                <Paper
                  key={item.id}
                  draggable={canDrag}
                  onDragStart={(event) => { if (canDrag) event.dataTransfer.setData('text/category-id', item.id); }}
                  onDragOver={(event) => { event.preventDefault(); setDragOverId(item.id); }}
                  onDragLeave={() => setDragOverId((current) => current === item.id ? null : current)}
                  onDrop={(event) => { event.preventDefault(); void handleDrop(item.id, event.dataTransfer.getData('text/category-id')); }}
                  onClick={() => onSelect(isRoot ? null : item.id)}
                  elevation={isSelected ? 8 : 2}
                  sx={{
                    position: 'absolute', left: item.x, top: item.y, width: NODE_WIDTH, height: NODE_HEIGHT,
                    p: 1.25, cursor: canDrag ? 'grab' : 'pointer', borderRadius: 3,
                    border: '1px solid',
                    borderColor: dragOverId === item.id ? 'success.main' : isSelected ? 'primary.main' : 'divider',
                    background: isRoot
                      ? (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.primary.dark})`
                      : isSelected
                        ? (t) => `linear-gradient(135deg, ${t.palette.primary.main}22, ${t.palette.background.paper} 70%)`
                        : 'background.paper',
                    color: isRoot ? 'primary.contrastText' : 'text.primary',
                    boxShadow: isSelected ? (t) => `0 0 0 4px ${t.palette.primary.main}22, ${t.shadows[8]}` : undefined,
                    transition: 'transform 150ms ease, box-shadow 150ms ease, border-color 150ms ease',
                    '&:hover': { transform: 'translateY(-2px)' },
                  }}
                >
                  <Stack direction="row" spacing={1} sx={{ alignItems: 'center', height: '100%' }}>
                    <Box sx={{ width: 50, height: 50, borderRadius: 2.25, display: 'grid', placeItems: 'center', bgcolor: isRoot ? '#ffffff26' : 'action.hover', color: isRoot ? 'inherit' : 'primary.main', flexShrink: 0, '& .MuiSvgIcon-root': { fontSize: 32 } }}>
                      {isRoot ? <HubOutlinedIcon /> : categoryIconFor(node?.name ?? '', node?.icon)}
                    </Box>
                    <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 800, lineHeight: 1.2, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{isRoot ? 'All categories' : node?.name}</Typography>
                      <Stack direction="row" spacing={0.75} sx={{ mt: 0.5, alignItems: 'center' }}>
                        <Chip size="small" label={`${count} ${itemLabel}${count === 1 ? '' : 's'}`} sx={{ height: 20, fontSize: '0.65rem', bgcolor: isRoot ? '#ffffff24' : undefined, color: 'inherit' }} />
                        {node && !node.isSystem && <Typography variant="caption" sx={{ opacity: 0.72 }}>homebrew</Typography>}
                      </Stack>
                    </Box>
                    <Stack spacing={0.1}>
                      {hasChildren && (
                        <Tooltip title={isExpanded ? 'Collapse branch' : 'Expand branch'}>
                          <IconButton size="small" onClick={(event) => { event.stopPropagation(); toggle(item.id); }} sx={{ color: 'inherit' }}>
                            {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Add child category">
                        <IconButton size="small" onClick={(event) => { event.stopPropagation(); setAddParent(isRoot ? null : item.id); }} sx={{ color: 'inherit' }}>
                          <AddIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </Stack>
                  {node && !node.isSystem && (
                    <Tooltip title="Delete category">
                      <IconButton
                        size="small"
                        onClick={(event) => { event.stopPropagation(); setDeleteTarget(node); }}
                        sx={{ position: 'absolute', right: -9, top: -9, width: 22, height: 22, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', '&:hover': { bgcolor: 'error.main', color: 'error.contrastText' } }}
                      >
                        <DeleteOutlineIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Paper>
              );
            })}
          </Box>
        </Box>
      </Box>

      {onCreateAt && (
        <Stack spacing={1} sx={{ position: 'absolute', right: 18, bottom: 18, zIndex: 7, alignItems: 'flex-end' }}>
          {secondaryAction}
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => onCreateAt(selectedId)} sx={{ boxShadow: 6 }}>
            New {itemLabel}{selectedId ? ' here' : ''}
          </Button>
        </Stack>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        itemName={deleteTarget?.name ?? ''}
        itemType="category node"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            void removeCategory(deleteTarget.id);
            if (selectedId === deleteTarget.id) onSelect(null);
          }
          setDeleteTarget(null);
        }}
      />

      <Dialog open={addParent !== undefined} onClose={() => setAddParent(undefined)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Add category node</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus fullWidth label="Category name" value={newName}
            onChange={(event) => setNewName(event.target.value)} sx={{ mt: 1 }}
            onKeyDown={(event) => { if (event.key === 'Enter') void submitCategory(); }}
            helperText="The new node will appear beneath the selected category."
          />
        </DialogContent>
        <DialogActions>
          <Button color="inherit" onClick={() => setAddParent(undefined)}>Cancel</Button>
          <Button variant="contained" disabled={!newName.trim()} onClick={() => void submitCategory()}>Add node</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import { useCategoryStore } from '../../../store/useCategoryStore';
import type { CategoryNode } from '../../../types/category';

interface CategoryTreeBrowserProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return base || `cat-${Math.random().toString(36).slice(2, 8)}`;
}

/** Collapsible tree of the category reference structure, with inline "+" affordances to add
 * user-authored child nodes under any existing node (or a new top-level node). Selection is
 * exact-match only (no descendant-inclusion) - simplest correct behavior; a TODO for anyone
 * who wants "select a branch and include its descendants" later. */
export function CategoryTreeBrowser({ selectedId, onSelect }: CategoryTreeBrowserProps) {
  const tree = useCategoryStore((s) => s.tree);
  const fetchTree = useCategoryStore((s) => s.fetchTree);
  const addCategory = useCategoryStore((s) => s.addCategory);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingUnder, setAddingUnder] = useState<string | null | 'none'>('none');
  const [newName, setNewName] = useState('');

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const startAdd = (parentId: string | null) => {
    setAddingUnder(parentId);
    setNewName('');
    if (parentId) setExpanded((prev) => new Set(prev).add(parentId));
  };

  const cancelAdd = () => {
    setAddingUnder('none');
    setNewName('');
  };

  const submitAdd = async () => {
    const name = newName.trim();
    if (addingUnder === 'none') return;
    if (!name) {
      cancelAdd();
      return;
    }
    const parentId = addingUnder;
    cancelAdd();
    await addCategory({ slug: slugify(name), name, parentId });
  };

  const renderAddField = (depth: number) => (
    <Stack direction="row" spacing={0.5} sx={{ pl: depth * 2 + 4, py: 0.25, alignItems: 'center' }}>
      <TextField
        size="small"
        variant="standard"
        autoFocus
        placeholder="New category name"
        value={newName}
        onChange={(e) => setNewName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submitAdd();
          if (e.key === 'Escape') cancelAdd();
        }}
        onBlur={submitAdd}
        sx={{ flexGrow: 1 }}
      />
    </Stack>
  );

  const renderNode = (node: CategoryNode, depth: number) => {
    const hasChildren = node.children.length > 0;
    const isExpanded = expanded.has(node.id);
    const isSelected = selectedId === node.id;
    return (
      <Box key={node.id}>
        <Stack
          direction="row"
          spacing={0.5}
          sx={{
            alignItems: 'center',
            pl: depth * 2,
            py: 0.25,
            borderRadius: 1,
            bgcolor: isSelected ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: isSelected ? 'action.selected' : 'action.hover' },
          }}
        >
          <IconButton
            size="small"
            sx={{ visibility: hasChildren ? 'visible' : 'hidden', p: 0.25 }}
            onClick={(e) => {
              e.stopPropagation();
              toggleExpanded(node.id);
            }}
          >
            {isExpanded ? <ExpandMoreIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
          </IconButton>
          <Box sx={{ flexGrow: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => onSelect(isSelected ? null : node.id)}>
            <Typography variant="body2" noWrap sx={{ fontWeight: isSelected ? 700 : 400 }}>
              {node.name}
            </Typography>
          </Box>
          {node.isSystem && <Chip label="system" size="small" variant="outlined" sx={{ height: 16, fontSize: '0.6rem' }} />}
          <Tooltip title="Add sub-category">
            <IconButton size="small" sx={{ p: 0.25 }} onClick={() => startAdd(node.id)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        {addingUnder === node.id && renderAddField(depth + 1)}
        {hasChildren && isExpanded && <Box>{node.children.map((child) => renderNode(child, depth + 1))}</Box>}
      </Box>
    );
  };

  return (
    <Box sx={{ minWidth: 220 }}>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, textTransform: 'uppercase' }}>
          Categories
        </Typography>
        <Tooltip title="Add top-level category">
          <IconButton size="small" onClick={() => startAdd(null)}>
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>

      <Stack
        direction="row"
        spacing={0.5}
        sx={{
          alignItems: 'center',
          py: 0.25,
          borderRadius: 1,
          cursor: 'pointer',
          bgcolor: selectedId === null ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: selectedId === null ? 'action.selected' : 'action.hover' },
        }}
        onClick={() => onSelect(null)}
      >
        <Box sx={{ width: 24, flexShrink: 0 }} />
        <Typography variant="body2" sx={{ fontWeight: selectedId === null ? 700 : 400 }}>
          All categories
        </Typography>
      </Stack>
      {addingUnder === null && renderAddField(0)}

      {tree.map((node) => renderNode(node, 0))}
    </Box>
  );
}

import { useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import FolderIcon from '@mui/icons-material/Folder';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import type { ArticleFolder } from '../../types/article';

interface ArticleFolderTreeProps {
  worldId: string;
  folders: ArticleFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  search: string;
  onSearchChange: (value: string) => void;
  onAddFolder: (folder: ArticleFolder) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
}

/** Custom, user-defined folder tree for the Articles system (distinct from World Manager's
 * static NPCs/Factions/Places entries) - add/rename/delete + search, one level of nesting is
 * all that's needed here (drag-to-reorder is a follow-up, not built in this pass). */
export function ArticleFolderTree({
  worldId,
  folders,
  selectedFolderId,
  onSelectFolder,
  search,
  onSearchChange,
  onAddFolder,
  onRenameFolder,
  onDeleteFolder,
}: ArticleFolderTreeProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [addingParentId, setAddingParentId] = useState<string | null | 'root'>(null);
  const [addingValue, setAddingValue] = useState('');

  const startAdd = (parentId: string | null) => {
    setAddingParentId(parentId ?? 'root');
    setAddingValue('');
  };
  const commitAdd = () => {
    const name = addingValue.trim();
    if (name) {
      onAddFolder({
        id: crypto.randomUUID(),
        worldId,
        parentId: addingParentId === 'root' ? null : addingParentId,
        name,
      });
    }
    setAddingParentId(null);
  };

  const startRename = (folder: ArticleFolder) => {
    setEditingId(folder.id);
    setEditingValue(folder.name);
  };
  const commitRename = () => {
    const name = editingValue.trim();
    if (editingId && name) onRenameFolder(editingId, name);
    setEditingId(null);
  };

  const renderFolder = (folder: ArticleFolder, depth: number) => {
    const children = folders.filter((f) => f.parentId === folder.id);
    const isEditing = editingId === folder.id;

    return (
      <Box key={folder.id}>
        {isEditing ? (
          <Stack direction="row" spacing={0.5} sx={{ pl: depth * 2, alignItems: 'center', py: 0.25 }}>
            <TextField
              size="small"
              autoFocus
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') setEditingId(null);
              }}
              fullWidth
            />
            <IconButton size="small" onClick={commitRename}>
              <CheckIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={() => setEditingId(null)}>
              <CloseIcon fontSize="small" />
            </IconButton>
          </Stack>
        ) : (
          <ListItemButton
            selected={selectedFolderId === folder.id}
            onClick={() => onSelectFolder(folder.id)}
            sx={{ borderRadius: 1.5, py: 0.4, pl: 1 + depth * 2 }}
          >
            <ListItemIcon sx={{ minWidth: 28 }}>
              <FolderIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText primary={folder.name} primaryTypographyProps={{ variant: 'body2', noWrap: true }} />
            <Stack direction="row" sx={{ opacity: 0.6 }}>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); startAdd(folder.id); }}>
                <AddIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); startRename(folder); }}>
                <EditIcon sx={{ fontSize: 14 }} />
              </IconButton>
              <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDeleteFolder(folder.id); }}>
                <DeleteOutlineIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Stack>
          </ListItemButton>
        )}
        {children.map((child) => renderFolder(child, depth + 1))}
        {addingParentId === folder.id && (
          <Stack direction="row" spacing={0.5} sx={{ pl: (depth + 1) * 2, alignItems: 'center', py: 0.25 }}>
            <TextField
              size="small"
              autoFocus
              placeholder="Folder name"
              value={addingValue}
              onChange={(e) => setAddingValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitAdd();
                if (e.key === 'Escape') setAddingParentId(null);
              }}
              fullWidth
            />
            <IconButton size="small" onClick={commitAdd}>
              <CheckIcon fontSize="small" />
            </IconButton>
          </Stack>
        )}
      </Box>
    );
  };

  const rootFolders = folders.filter((f) => f.parentId === null);

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, px: 1, mb: 0.75 }}>
        Articles
      </Typography>
      <TextField
        size="small"
        placeholder="Search folders…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        fullWidth
        sx={{ mb: 1 }}
        slotProps={{ input: { startAdornment: <InputAdornment position="start"><SearchIcon sx={{ fontSize: 16 }} /></InputAdornment> } }}
      />

      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" color="text.disabled" sx={{ px: 1 }}>
          FOLDERS
        </Typography>
        <IconButton size="small" onClick={() => startAdd(null)}>
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Stack>

      <ListItemButton selected={selectedFolderId === null} onClick={() => onSelectFolder(null)} sx={{ borderRadius: 1.5, py: 0.4 }}>
        <ListItemText primary="All articles" primaryTypographyProps={{ variant: 'body2' }} />
      </ListItemButton>

      {rootFolders.map((folder) => renderFolder(folder, 0))}

      {addingParentId === 'root' && (
        <Stack direction="row" spacing={0.5} sx={{ pl: 1, alignItems: 'center', py: 0.25 }}>
          <TextField
            size="small"
            autoFocus
            placeholder="Folder name"
            value={addingValue}
            onChange={(e) => setAddingValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitAdd();
              if (e.key === 'Escape') setAddingParentId(null);
            }}
            fullWidth
          />
          <IconButton size="small" onClick={commitAdd}>
            <CheckIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}
    </Box>
  );
}

import { useState } from 'react';
import Box from '@mui/material/Box';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableSortLabel from '@mui/material/TableSortLabel';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import EditIcon from '@mui/icons-material/EditOutlined';
import { ARTICLE_TEMPLATES, type Article, type ArticleFolder } from '../../types/article';
import { getArticleCategoryIcon } from './articleIcons';
import { formatRelativeTime } from '../../utils/formatRelativeTime';

type SortKey = 'name' | 'category' | 'folder' | 'updatedAt';

interface ArticleTableProps {
  articles: Article[];
  folders: ArticleFolder[];
  onOpen: (articleId: string) => void;
}

export function ArticleTable({ articles, folders, onOpen }: ArticleTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const folderName = (id: string | null) => (id ? folders.find((f) => f.id === id)?.name ?? '—' : '—');

  const sorted = [...articles].sort((a, b) => {
    let cmp = 0;
    if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
    else if (sortKey === 'category') cmp = ARTICLE_TEMPLATES[a.category].label.localeCompare(ARTICLE_TEMPLATES[b.category].label);
    else if (sortKey === 'folder') cmp = folderName(a.folderId).localeCompare(folderName(b.folderId));
    else cmp = a.updatedAt - b.updatedAt;
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const headCell = (key: SortKey, label: string) => (
    <TableCell>
      <TableSortLabel active={sortKey === key} direction={sortKey === key ? sortDir : 'asc'} onClick={() => toggleSort(key)}>
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <Box>
      {sorted.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          No articles here yet.
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                {headCell('name', 'Name')}
                {headCell('category', 'Type')}
                {headCell('folder', 'Folder')}
                <TableCell>Tags</TableCell>
                {headCell('updatedAt', 'Updated')}
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {sorted.map((article) => {
                const template = ARTICLE_TEMPLATES[article.category];
                return (
                  <TableRow key={article.id} hover sx={{ cursor: 'pointer' }} onClick={() => onOpen(article.id)}>
                    <TableCell sx={{ fontWeight: 600 }}>{article.name}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
                        <Box sx={{ display: 'flex', fontSize: 16 }}>{getArticleCategoryIcon(template.icon)}</Box>
                        {template.label}
                      </Stack>
                    </TableCell>
                    <TableCell>{folderName(article.folderId)}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        {article.tags.slice(0, 3).map((tag) => (
                          <Chip key={tag} label={tag} size="small" sx={{ height: 18, fontSize: 10 }} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>{formatRelativeTime(article.updatedAt)}</TableCell>
                    <TableCell align="right">
                      <IconButton size="small" onClick={(e) => { e.stopPropagation(); onOpen(article.id); }}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

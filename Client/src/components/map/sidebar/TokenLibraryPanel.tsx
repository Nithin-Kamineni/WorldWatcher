import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CircularProgress from '@mui/material/CircularProgress';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import { useTokenLibraryStore } from '../../../store/useTokenLibraryStore';
import { useCreatureStore } from '../../../store/useCreatureStore';
import { useDebouncedValue } from '../../../hooks/useDebouncedValue';
import { TokenFormDialog } from './TokenFormDialog';
import { SizeControl } from '../SizeControl';
import { TokenThumbnail } from '../TokenThumbnail';
import type { Creature } from '../../../types/creature';
import type { TokenDefinition } from '../../../types/token';
import { TOKEN_DRAG_MIME, FAVORITE_CREATURE_DRAG_MIME } from '../../../utils/tokenDrag';

/** Server caps `limit` at 500 (see Server/app/api/utils.py's PaginationDep) - a library of
 * 4,000+ imported monsters needs real page accumulation, not just a growing single-page limit. */
const PAGE_SIZE = 100;

interface TokenLibraryPanelProps {
  campaignId: string;
}

export function TokenLibraryPanel({ campaignId }: TokenLibraryPanelProps) {
  const tokens = useTokenLibraryStore((state) => state.tokens);
  const addToken = useTokenLibraryStore((state) => state.addToken);
  const updateToken = useTokenLibraryStore((state) => state.updateToken);
  const deleteToken = useTokenLibraryStore((state) => state.deleteToken);
  const toggleFavorite = useTokenLibraryStore((state) => state.toggleFavorite);
  const fetchTokenLibrary = useTokenLibraryStore((state) => state.fetchTokenLibrary);

  const creatureBrowse = useCreatureStore((state) => state.creatureBrowse);
  const creatureBrowseLoading = useCreatureStore((state) => state.creatureBrowseLoading);
  const fetchCreatureBrowse = useCreatureStore((state) => state.fetchCreatureBrowse);
  const updateCreatureInCampaign = useCreatureStore((state) => state.updateCreatureInCampaign);

  useEffect(() => {
    fetchTokenLibrary();
  }, [fetchTokenLibrary]);

  const [query, setQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingToken, setEditingToken] = useState<TokenDefinition | undefined>(undefined);
  const [page, setPage] = useState(1);
  const [loadedCreatures, setLoadedCreatures] = useState<Creature[]>([]);

  const debouncedQuery = useDebouncedValue(query.trim(), 250);

  useEffect(() => {
    setPage(1);
    setLoadedCreatures([]);
  }, [debouncedQuery, campaignId]);

  useEffect(() => {
    fetchCreatureBrowse({
      campaignId,
      scope: 'own_or_global',
      page,
      pageSize: PAGE_SIZE,
      search: debouncedQuery || undefined,
    });
  }, [campaignId, page, debouncedQuery, fetchCreatureBrowse]);

  useEffect(() => {
    if (!creatureBrowse) return;
    setLoadedCreatures((prev) => {
      if (page === 1) return creatureBrowse.items;
      const seen = new Set(prev.map((c) => c.id));
      return [...prev, ...creatureBrowse.items.filter((c) => !seen.has(c.id))];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creatureBrowse]);

  const allCreatures = useMemo(
    () =>
      [...loadedCreatures].sort((a, b) => {
        if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [loadedCreatures],
  );
  const creatureTotal = creatureBrowse?.total ?? 0;
  const hasMoreCreatures = allCreatures.length < creatureTotal;

  const filteredTokens = useMemo(
    () => tokens.filter((token) => token.name.toLowerCase().includes(query.trim().toLowerCase())),
    [tokens, query],
  );

  const handleAddClick = () => {
    setEditingToken(undefined);
    setDialogOpen(true);
  };

  const handleEditClick = (token: TokenDefinition) => {
    setEditingToken(token);
    setDialogOpen(true);
  };

  const handleSubmit = (token: TokenDefinition) => {
    if (editingToken) {
      updateToken(token);
    } else {
      addToken(token);
    }
    setDialogOpen(false);
    setEditingToken(undefined);
  };

  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ p: 2, pb: 1 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Tokens
        </Typography>
        <TextField
          size="small"
          fullWidth
          placeholder="Search tokens…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            },
          }}
        />
      </Box>

      <Divider />

      <Stack sx={{ flexGrow: 1, overflowY: 'auto', p: 1 }} spacing={0.5}>
        {allCreatures.length === 0 && filteredTokens.length === 0 && !creatureBrowseLoading && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No tokens found.
          </Typography>
        )}

        {allCreatures.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', px: 0.75, pt: 0.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, flexGrow: 1 }}>
              Creatures ({allCreatures.length} of {creatureTotal})
            </Typography>
            {creatureBrowseLoading && <CircularProgress size={12} />}
          </Stack>
        )}
        {allCreatures.map((creature) => (
          <Box
            key={creature.id}
            sx={{
              p: 0.75,
              borderRadius: 2,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(FAVORITE_CREATURE_DRAG_MIME, creature.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              sx={{ alignItems: 'center', cursor: 'grab' }}
            >
              <TokenThumbnail src={creature.tokenImage} name={creature.name} size={40} />
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {creature.name}
              </Typography>
              <Tooltip title={creature.isFavorite ? 'Unfavorite' : 'Favorite'}>
                <IconButton
                  size="small"
                  onClick={() =>
                    updateCreatureInCampaign(campaignId, { ...creature, isFavorite: !creature.isFavorite })
                  }
                >
                  {creature.isFavorite ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pl: 6, mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary">
                Size
              </Typography>
              <SizeControl
                currentSize={creature.currentSize}
                defaultSize={creature.defaultSize}
                onCurrentChange={(currentSize) => updateCreatureInCampaign(campaignId, { ...creature, currentSize })}
              />
            </Stack>
          </Box>
        ))}

        {hasMoreCreatures && (
          <Button
            size="small"
            onClick={() => setPage((p) => p + 1)}
            disabled={creatureBrowseLoading}
            sx={{ alignSelf: 'center', mt: 0.5 }}
          >
            Load more ({creatureTotal - allCreatures.length} remaining)
          </Button>
        )}

        {allCreatures.length > 0 && filteredTokens.length > 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ px: 0.75, pt: 1, fontWeight: 700 }}>
            Tokens
          </Typography>
        )}
        {filteredTokens.map((token) => (
          <Box
            key={token.id}
            sx={{
              p: 0.75,
              borderRadius: 2,
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <Stack
              direction="row"
              spacing={1}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(TOKEN_DRAG_MIME, token.id);
                e.dataTransfer.effectAllowed = 'copy';
              }}
              sx={{ alignItems: 'center', cursor: 'grab' }}
            >
              <Box
                component="img"
                src={token.imageSrc}
                alt={token.name}
                sx={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              />
              <Typography variant="body2" sx={{ flexGrow: 1, minWidth: 0 }} noWrap>
                {token.name}
              </Typography>
              <Tooltip title={token.isFavorite ? 'Unfavorite' : 'Favorite'}>
                <IconButton size="small" onClick={() => toggleFavorite(token.id)}>
                  {token.isFavorite ? <StarIcon fontSize="small" color="primary" /> : <StarBorderIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Edit token">
                <IconButton size="small" onClick={() => handleEditClick(token)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete token">
                <IconButton size="small" onClick={() => deleteToken(token.id)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pl: 6, mt: 0.25 }}>
              <Typography variant="caption" color="text.secondary">
                Size
              </Typography>
              <SizeControl
                currentSize={token.currentSize}
                defaultSize={token.defaultSize}
                onCurrentChange={(currentSize) => updateToken({ ...token, currentSize })}
              />
            </Stack>
          </Box>
        ))}
      </Stack>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={handleAddClick}>
          Add Token
        </Button>
      </Box>

      <TokenFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleSubmit}
        initialToken={editingToken}
      />
    </Stack>
  );
}

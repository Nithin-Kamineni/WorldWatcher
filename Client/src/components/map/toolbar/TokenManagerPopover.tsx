import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import Popover from '@mui/material/Popover';
import ClickAwayListener from '@mui/material/ClickAwayListener';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import FavoriteIcon from '@mui/icons-material/Favorite';
import { useTokenLibraryStore } from '../../../store/useTokenLibraryStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../../store/useCreatureStore';
import { useTokenManagerUiStore } from '../../../store/useTokenManagerUiStore';
import { MAX_TOKEN_SIZE, MIN_TOKEN_SIZE, TOKEN_OUTLINE_WIDTH, type PlacedToken } from '../../../types/token';
import { TOKEN_DRAG_MIME, FAVORITE_CREATURE_DRAG_MIME } from '../../../utils/tokenDrag';
import type { EncounterCreatureEntry } from '../../../types/encounter';
import { TokenEffectsEditor } from './TokenEffectsEditor';
import { EncountersTokenTab } from './EncountersTokenTab';
import { TokenThumbnail } from '../TokenThumbnail';
import { SizeControl } from '../SizeControl';

type TokenChanges = Partial<
  Pick<PlacedToken, 'name' | 'size' | 'outlineColor' | 'effects' | 'hp' | 'concentrating' | 'deathSaves'>
>;
export type TokenManagerTab = 'floor' | 'favorites' | 'encounters';

interface TokenManagerPopoverProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  anchorPosition?: { top: number; left: number } | null;
  onClose: () => void;
  placedTokens: PlacedToken[];
  onUpdateToken: (tokenId: string, changes: TokenChanges) => void;
  onDeleteToken: (tokenId: string) => void;
  focusTokenId: string | null;
  initialTab: TokenManagerTab;
  campaignId: string;
  lockedEncounterId: string | null | undefined;
  onLockEncounter: (encounterId: string | null) => void;
  resolvedEncounterRoster: EncounterCreatureEntry[] | null;
  onSetResolvedEncounterRoster: (roster: EncounterCreatureEntry[] | null) => void;
  encounterActive: boolean;
}

function clampSize(value: number): number {
  if (Number.isNaN(value)) return MIN_TOKEN_SIZE;
  return Math.min(MAX_TOKEN_SIZE, Math.max(MIN_TOKEN_SIZE, value));
}

function TokenRow({
  token,
  focused,
  focusRef,
  onUpdateToken,
  onDeleteToken,
  encounterActive,
}: {
  token: PlacedToken;
  focused: boolean;
  focusRef: RefObject<HTMLDivElement | null> | undefined;
  onUpdateToken: (tokenId: string, changes: TokenChanges) => void;
  onDeleteToken: (tokenId: string) => void;
  encounterActive: boolean;
}) {
  const [nameInput, setNameInput] = useState(token.name);

  useEffect(() => {
    setNameInput(token.name);
  }, [token.name]);

  const commitName = () => {
    const trimmed = nameInput.trim();
    if (trimmed && trimmed !== token.name) {
      onUpdateToken(token.id, { name: trimmed });
    } else {
      setNameInput(token.name);
    }
  };

  return (
    <Box
      ref={focusRef}
      sx={{
        p: 1,
        borderRadius: 2,
        bgcolor: focused ? 'action.selected' : 'action.hover',
      }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <TokenThumbnail
          src={token.imageSrc}
          name={token.name}
          size={36}
          border={`${TOKEN_OUTLINE_WIDTH}px solid ${token.outlineColor}`}
        />
        <TextField
          variant="standard"
          size="small"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          }}
          sx={{ flexGrow: 1 }}
        />
        <Tooltip title="Remove from map">
          <IconButton size="small" onClick={() => onDeleteToken(token.id)}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ width: 32 }}>
          Size
        </Typography>
        <Slider
          size="small"
          value={token.size}
          min={MIN_TOKEN_SIZE}
          max={MAX_TOKEN_SIZE}
          onChange={(_e, value) => onUpdateToken(token.id, { size: value as number })}
        />
        <TextField
          type="number"
          size="small"
          variant="standard"
          value={token.size}
          onChange={(e) => onUpdateToken(token.id, { size: clampSize(Number(e.target.value)) })}
          sx={{ width: 48, flexShrink: 0 }}
          slotProps={{ htmlInput: { min: MIN_TOKEN_SIZE, max: MAX_TOKEN_SIZE, style: { textAlign: 'right' } } }}
        />
        <input
          type="color"
          value={token.outlineColor}
          onChange={(e) => onUpdateToken(token.id, { outlineColor: e.target.value })}
          style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', flexShrink: 0 }}
        />
      </Stack>
      <TokenEffectsEditor
        effects={token.effects}
        onChange={(effects) => onUpdateToken(token.id, { effects })}
      />

      {encounterActive && (
        <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <FavoriteIcon fontSize="small" color="error" />
            <TextField
              type="number"
              size="small"
              variant="standard"
              label="HP"
              value={token.hp?.current ?? 0}
              onChange={(e) =>
                onUpdateToken(token.id, { hp: { current: Number(e.target.value), max: token.hp?.max ?? 0 } })
              }
              sx={{ width: 60 }}
            />
            <Typography variant="body2" color="text.secondary">
              /
            </Typography>
            <TextField
              type="number"
              size="small"
              variant="standard"
              label="Max"
              value={token.hp?.max ?? 0}
              onChange={(e) =>
                onUpdateToken(token.id, { hp: { current: token.hp?.current ?? 0, max: Number(e.target.value) } })
              }
              sx={{ width: 60 }}
            />
            <FormControlLabel
              sx={{ ml: 1 }}
              control={
                <Checkbox
                  size="small"
                  checked={!!token.concentrating}
                  onChange={(e) => onUpdateToken(token.id, { concentrating: e.target.checked })}
                />
              }
              label={<Typography variant="caption">Conc.</Typography>}
            />
          </Stack>
          {token.hp && token.hp.current <= 0 && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 0.5 }}>
              <Typography variant="caption" color="text.secondary">
                Death saves
              </Typography>
              {[0, 1, 2].map((i) => (
                <Checkbox
                  key={`s-${i}`}
                  size="small"
                  checked={(token.deathSaves?.successes ?? 0) > i}
                  onChange={() =>
                    onUpdateToken(token.id, {
                      deathSaves: {
                        successes: (token.deathSaves?.successes ?? 0) > i ? i : i + 1,
                        failures: token.deathSaves?.failures ?? 0,
                      },
                    })
                  }
                  sx={{ color: 'success.main', p: 0.25 }}
                />
              ))}
              {[0, 1, 2].map((i) => (
                <Checkbox
                  key={`f-${i}`}
                  size="small"
                  checked={(token.deathSaves?.failures ?? 0) > i}
                  onChange={() =>
                    onUpdateToken(token.id, {
                      deathSaves: {
                        failures: (token.deathSaves?.failures ?? 0) > i ? i : i + 1,
                        successes: token.deathSaves?.successes ?? 0,
                      },
                    })
                  }
                  sx={{ color: 'error.main', p: 0.25 }}
                />
              ))}
            </Stack>
          )}
        </Box>
      )}
    </Box>
  );
}

export function TokenManagerPopover({
  open,
  anchorEl,
  anchorPosition,
  onClose,
  placedTokens,
  onUpdateToken,
  onDeleteToken,
  focusTokenId,
  initialTab,
  campaignId,
  lockedEncounterId,
  onLockEncounter,
  resolvedEncounterRoster,
  onSetResolvedEncounterRoster,
  encounterActive,
}: TokenManagerPopoverProps) {
  const [tab, setTab] = useState<TokenManagerTab>(initialTab);
  const setLastTab = useTokenManagerUiStore((state) => state.setLastTab);
  const libraryTokens = useTokenLibraryStore((state) => state.tokens);
  const updateLibraryToken = useTokenLibraryStore((state) => state.updateToken);
  const favoriteTokens = useMemo(() => libraryTokens.filter((t) => t.isFavorite), [libraryTokens]);
  const creaturesByCampaignId = useCreatureStore((state) => state.creaturesByCampaignId);
  const updateCreatureInCampaign = useCreatureStore((state) => state.updateCreatureInCampaign);
  const favoriteCreatures = useMemo(
    () => getCreaturesForCampaign(creaturesByCampaignId, campaignId).filter((c) => c.isFavorite),
    [creaturesByCampaignId, campaignId],
  );
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);

  useEffect(() => {
    if (open && focusTokenId && tab === 'floor') {
      focusRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [open, focusTokenId, tab]);

  return (
    <Popover
      open={open}
      anchorReference={anchorPosition ? 'anchorPosition' : 'anchorEl'}
      anchorEl={anchorEl}
      anchorPosition={anchorPosition ?? undefined}
      onClose={onClose}
      hideBackdrop
      sx={{ pointerEvents: 'none' }}
      slotProps={{
        paper: {
          sx: { pointerEvents: 'auto', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' },
        },
      }}
      anchorOrigin={{ vertical: -12, horizontal: 'center' }}
      transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <ClickAwayListener onClickAway={onClose}>
      <Box sx={{ width: 360 }}>
        <Tabs
          value={tab}
          onChange={(_e, v) => {
            setTab(v);
            setLastTab(v);
          }}
          variant="fullWidth"
        >
          <Tab value="floor" label="This Floor" />
          <Tab value="favorites" label="Favorites" />
          <Tab value="encounters" label="Encounters" />
        </Tabs>

        {tab === 'floor' && (
          <Stack sx={{ maxHeight: 360, overflowY: 'auto', p: 1.5 }} spacing={1.5}>
            {placedTokens.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                No tokens on this floor yet. Drag one in from Favorites.
              </Typography>
            )}
            {placedTokens.map((token) => (
              <TokenRow
                key={token.id}
                token={token}
                focused={token.id === focusTokenId}
                focusRef={token.id === focusTokenId ? focusRef : undefined}
                onUpdateToken={onUpdateToken}
                onDeleteToken={onDeleteToken}
                encounterActive={encounterActive}
              />
            ))}
          </Stack>
        )}

        {tab === 'favorites' && (
          <Stack sx={{ maxHeight: 360, overflowY: 'auto', p: 1.5 }} spacing={0.5}>
            {favoriteTokens.length === 0 && favoriteCreatures.length === 0 && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
                Star a token in the sidebar, or a monster/NPC in the Creatures table, to add it here.
              </Typography>
            )}
            {favoriteCreatures.map((creature) => (
              <Box key={creature.id} sx={{ p: 1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                <Stack
                  direction="row"
                  spacing={1.5}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData(FAVORITE_CREATURE_DRAG_MIME, creature.id);
                    e.dataTransfer.effectAllowed = 'copy';
                  }}
                  sx={{ alignItems: 'center', cursor: 'grab' }}
                >
                  <TokenThumbnail src={creature.tokenImage} name={creature.name} size={36} />
                  <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                    {creature.name}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pl: 6.5, mt: 0.25 }}>
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
            {favoriteTokens.map((token) => (
              <Box key={token.id} sx={{ p: 1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                <Stack
                  direction="row"
                  spacing={1.5}
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
                    sx={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <Typography variant="body2" sx={{ flexGrow: 1 }} noWrap>
                    {token.name}
                  </Typography>
                </Stack>
                <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', pl: 6.5, mt: 0.25 }}>
                  <Typography variant="caption" color="text.secondary">
                    Size
                  </Typography>
                  <SizeControl
                    currentSize={token.currentSize}
                    defaultSize={token.defaultSize}
                    onCurrentChange={(currentSize) => updateLibraryToken({ ...token, currentSize })}
                  />
                </Stack>
              </Box>
            ))}
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', pt: 1 }}>
              Drag a favorite onto the map to place it.
            </Typography>
          </Stack>
        )}

        {tab === 'encounters' && (
          <EncountersTokenTab
            campaignId={campaignId}
            placedTokens={placedTokens}
            lockedEncounterId={lockedEncounterId}
            onLockEncounter={onLockEncounter}
            resolvedRoster={resolvedEncounterRoster}
            onSetResolvedRoster={onSetResolvedEncounterRoster}
          />
        )}
      </Box>
      </ClickAwayListener>
    </Popover>
  );
}

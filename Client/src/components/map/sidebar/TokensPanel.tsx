import { useEffect, useRef, useState, type RefObject } from 'react';
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
import PeopleAltIcon from '@mui/icons-material/PeopleAlt';
import { useTokenManagerUiStore, type TokenManagerTab } from '../../../store/useTokenManagerUiStore';
import {
  MAX_RELATIVE_SIZE,
  MIN_RELATIVE_SIZE,
  TOKEN_OUTLINE_WIDTH,
  tokenSizeFromSquares,
  tokenSizeToSquares,
  type PlacedToken,
} from '../../../types/token';
import type { EncounterCreatureEntry } from '../../../types/encounter';
import { SectionHeader } from '../../shell/SectionHeader';
import { TokenEffectsEditor } from './TokenEffectsEditor';
import { EncountersTokenTab } from './EncountersTokenTab';
import { TokenLibraryPanel } from './TokenLibraryPanel';
import { TokenThumbnail } from '../TokenThumbnail';

export type TokenChanges = Partial<
  Pick<PlacedToken, 'name' | 'size' | 'outlineColor' | 'effects' | 'hp' | 'concentrating' | 'deathSaves'>
>;

function TokenRow({
  token,
  focused,
  focusRef,
  onUpdateToken,
  onDeleteToken,
  encounterActive,
  gridSize,
}: {
  token: PlacedToken;
  focused: boolean;
  focusRef: RefObject<HTMLDivElement | null> | undefined;
  onUpdateToken: (tokenId: string, changes: TokenChanges) => void;
  onDeleteToken: (tokenId: string) => void;
  encounterActive: boolean;
  gridSize: number;
}) {
  const squares = tokenSizeToSquares(token.size, gridSize);
  const setSquares = (value: number) => onUpdateToken(token.id, { size: tokenSizeFromSquares(value, gridSize) });

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
        {/* In SQUARES, not pixels - the unit the DM thinks in (Large = 2) and the one every
            other size control in the app already uses. Stored as px, converted through this
            map's grid. */}
        <Tooltip title="Size in grid squares (Medium = 1, Large = 2)">
          <Typography variant="caption" color="text.secondary" sx={{ width: 32 }}>
            Size
          </Typography>
        </Tooltip>
        <Slider
          size="small"
          value={squares}
          min={MIN_RELATIVE_SIZE}
          max={MAX_RELATIVE_SIZE}
          step={0.25}
          onChange={(_e, value) => setSquares(value as number)}
        />
        <TextField
          type="number"
          size="small"
          variant="standard"
          value={squares}
          onChange={(e) => setSquares(Number(e.target.value))}
          sx={{ width: 48, flexShrink: 0 }}
          slotProps={{
            htmlInput: { min: MIN_RELATIVE_SIZE, max: MAX_RELATIVE_SIZE, step: 0.25, style: { textAlign: 'right' } },
          }}
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

/** Everything about tokens, in the map sidebar: what is on this floor (edit it), the library
 * (drag from it), and the campaign's encounters (drag their rosters in).
 *
 * This used to be two places. The sidebar's Tokens section was the library, and a "Manage
 * tokens" button in the bottom toolbar opened a popover with This Floor / Favorites /
 * Encounters - so placing a token had two homes, and editing one lived in a popover that
 * closed the moment the DM clicked the map to see what they had changed. The toolbar is for
 * tools that act on the canvas; a roster the DM keeps open while running combat is a panel.
 * The popover's Favorites tab is gone rather than moved: the library already lists
 * favourites first, with the same drag and the same size control.
 *
 * Right-clicking a token (or the quick-edit hotkey) opens this on "On map", scrolled to that
 * token's row - the page does that through MapSidebar's open request. */
export function TokensPanel({
  campaignId,
  placedTokens,
  onUpdateToken,
  onDeleteToken,
  focusTokenId,
  tab,
  onTabChange,
  lockedEncounterId,
  onLockEncounter,
  resolvedEncounterRoster,
  onSetResolvedEncounterRoster,
  encounterActive,
  gridSize,
}: {
  campaignId: string;
  placedTokens: PlacedToken[];
  onUpdateToken: (tokenId: string, changes: TokenChanges) => void;
  onDeleteToken: (tokenId: string) => void;
  /** Row to highlight and scroll to on "On map". */
  focusTokenId: string | null;
  tab: TokenManagerTab;
  onTabChange: (tab: TokenManagerTab) => void;
  lockedEncounterId: string | null | undefined;
  onLockEncounter: (encounterId: string | null) => void;
  resolvedEncounterRoster: EncounterCreatureEntry[] | null;
  onSetResolvedEncounterRoster: (roster: EncounterCreatureEntry[] | null) => void;
  encounterActive: boolean;
  gridSize: number;
}) {
  const setLastTab = useTokenManagerUiStore((state) => state.setLastTab);
  const focusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (focusTokenId && tab === 'floor') {
      focusRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }, [focusTokenId, tab]);

  return (
    <Stack sx={{ height: '100%', minHeight: 0 }}>
      <SectionHeader icon={<PeopleAltIcon fontSize="small" />} title="Tokens" />
      <Tabs
        value={tab}
        onChange={(_e, v: TokenManagerTab) => {
          onTabChange(v);
          setLastTab(v);
        }}
        variant="fullWidth"
        sx={{ flexShrink: 0, borderBottom: 1, borderColor: 'divider' }}
      >
        <Tab value="floor" label={`On map${placedTokens.length ? ` (${placedTokens.length})` : ''}`} />
        <Tab value="library" label="Library" />
        <Tab value="encounters" label="Encounters" />
      </Tabs>

      {tab === 'floor' && (
        <Stack sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: 1.25 }} spacing={1.25}>
          {placedTokens.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 2 }}>
              No tokens on this floor yet. Drag one in from the Library or an encounter.
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
              gridSize={gridSize}
            />
          ))}
        </Stack>
      )}

      {tab === 'library' && (
        <Box sx={{ flexGrow: 1, minHeight: 0 }}>
          <TokenLibraryPanel campaignId={campaignId} />
        </Box>
      )}

      {tab === 'encounters' && (
        <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto' }}>
          <EncountersTokenTab
            campaignId={campaignId}
            placedTokens={placedTokens}
            lockedEncounterId={lockedEncounterId}
            onLockEncounter={onLockEncounter}
            resolvedRoster={resolvedEncounterRoster}
            onSetResolvedRoster={onSetResolvedEncounterRoster}
          />
        </Box>
      )}
    </Stack>
  );
}

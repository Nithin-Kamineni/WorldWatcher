import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import type { InitiativeState } from '../../types/initiative';
import type { PlacedToken } from '../../types/token';
import { TokenThumbnail } from './TokenThumbnail';

interface InitiativeBarProps {
  placedTokens: PlacedToken[];
  initiative: InitiativeState;
  onAdvanceTurn: () => void;
  onTokenStatsRequest: (token: PlacedToken) => void;
}

type BarMode = 'full' | 'compact' | 'hidden';

const NORMAL_SIZE = 56;
const CURRENT_SIZE = 88;

// scrollbar stays invisible until the row is hovered, so it never looks like clutter
// sitting over the map - it only appears while the DM is actually about to scroll it.
const scrollbarSx = {
  scrollBehavior: 'smooth',
  scrollbarWidth: 'thin',
  scrollbarColor: 'transparent transparent',
  '&:hover': { scrollbarColor: 'rgba(255,255,255,0.45) transparent' },
  '&::-webkit-scrollbar': { height: 7 },
  '&::-webkit-scrollbar-track': { background: 'transparent' },
  '&::-webkit-scrollbar-thumb': { background: 'transparent', borderRadius: 4 },
  '&:hover::-webkit-scrollbar-thumb': { background: 'rgba(255,255,255,0.45)' },
} as const;

// visually obvious glow marking a row whose initiative isn't locked yet - either it was
// never locked (freshly rolled) or the DM unlocked it to make an edit mid-encounter.
const unlockedGlowSx = {
  boxShadow: '0 0 0 3px rgba(255,255,255,0.9), 0 0 14px 4px rgba(255,255,255,0.6)',
} as const;

function TokenBox({
  token,
  isCurrent,
  isUnlocked,
  opacity,
  onClick,
  onDoubleClick,
  boxRef,
}: {
  token: PlacedToken;
  isCurrent: boolean;
  isUnlocked: boolean;
  opacity: number;
  onClick?: () => void;
  onDoubleClick: () => void;
  boxRef?: (el: HTMLDivElement | null) => void;
}) {
  const size = isCurrent ? CURRENT_SIZE : NORMAL_SIZE;
  const isBloodied = !!token.hp && token.hp.max > 0 && token.hp.current <= token.hp.max / 2;
  return (
    <Stack
      ref={boxRef}
      spacing={0.5}
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      sx={{
        alignItems: 'center',
        width: size,
        flexShrink: 0,
        cursor: onClick ? 'pointer' : 'default',
        opacity,
        transition: 'width 0.2s, opacity 0.2s',
      }}
    >
      <Box sx={{ position: 'relative', width: size, height: size }}>
        <TokenThumbnail
          src={token.imageSrc}
          name={token.name}
          size={size}
          border={`3px solid ${token.outlineColor}`}
          sx={{ transition: 'width 0.2s, height 0.2s, box-shadow 0.2s', borderRadius: '50%', ...(isUnlocked ? unlockedGlowSx : {}) }}
        />
        {token.relationTint && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              bgcolor: token.relationTint,
              opacity: 0.22,
              pointerEvents: 'none',
            }}
          />
        )}
        {isBloodied && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              borderRadius: '50%',
              boxShadow: 'inset 0 0 0 3px #ff1744',
              pointerEvents: 'none',
            }}
          />
        )}
      </Box>
      <Typography variant="caption" noWrap sx={{ maxWidth: size, color: 'common.white', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
        {token.name}
      </Typography>
    </Stack>
  );
}

export function InitiativeBar({ placedTokens, initiative, onAdvanceTurn, onTokenStatsRequest }: InitiativeBarProps) {
  const [mode, setMode] = useState<BarMode>('full');
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentTokenRef = useRef<HTMLDivElement | null>(null);

  const tokenById = new Map(placedTokens.map((t) => [t.id, t]));
  const sorted = [...initiative.entries]
    .map((entry) => ({ entry, token: tokenById.get(entry.tokenId) }))
    .filter((e): e is { entry: (typeof initiative.entries)[number]; token: PlacedToken } => !!e.token)
    .sort((a, b) => (b.entry.roll ?? 0) - (a.entry.roll ?? 0));

  const currentIndex = sorted.findIndex((e) => e.entry.id === initiative.currentEntryId);

  // seamlessly follow whoever's turn it is - re-centers the scroll on turn changes
  // (and keeps it centered if the roster changes) without ever jumping abruptly.
  useEffect(() => {
    if (mode !== 'full') return;
    currentTokenRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [initiative.currentEntryId, mode, sorted.length]);

  if (initiative.status === 'idle') return null;
  if (sorted.length === 0) return null;

  const cycleMode = () => {
    setMode((m) => (m === 'full' ? 'compact' : m === 'compact' ? 'hidden' : 'full'));
  };

  const cycleButton = (
    <Tooltip title={mode === 'hidden' ? 'Show initiative order' : 'Cycle initiative bar view'}>
      <IconButton
        size="small"
        onClick={cycleMode}
        sx={{ color: 'common.white', flexShrink: 0, bgcolor: mode === 'hidden' ? 'rgba(0,0,0,0.35)' : 'transparent' }}
      >
        {mode === 'full' ? <ViewColumnIcon fontSize="small" /> : mode === 'compact' ? <VisibilityOffIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
      </IconButton>
    </Tooltip>
  );

  if (mode === 'hidden') {
    return <Box sx={{ pointerEvents: 'auto' }}>{cycleButton}</Box>;
  }

  // previous (1, only if one exists - no wraparound) + current + next (2), clipped to bounds
  const visible =
    mode === 'full'
      ? sorted
      : currentIndex === -1
        ? sorted.slice(0, 3)
        : [currentIndex - 1, currentIndex, currentIndex + 1, currentIndex + 2]
            .filter((i) => i >= 0 && i < sorted.length)
            .map((i) => sorted[i]);

  return (
    <Paper
      elevation={4}
      sx={{
        pointerEvents: 'auto',
        bgcolor: 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(3px)',
        borderRadius: 3,
        px: 1.5,
        py: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        width: 'fit-content',
        maxWidth: '80%',
        minWidth: 0,
      }}
    >
      {cycleButton}
      <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.3)' }} />
      <Box
        ref={scrollRef}
        sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1.5,
          flex: '1 1 auto',
          minWidth: 0,
          overflowX: mode === 'full' ? 'auto' : 'visible',
          overflowY: 'hidden',
          pb: 0.5,
          ...scrollbarSx,
        }}
      >
        {visible.map(({ entry, token }) => {
          const isCurrent = entry.id === initiative.currentEntryId;
          const opacity = mode === 'full' ? 1 : isCurrent ? 0.5 : 0.2;
          const isUnlocked = initiative.status === 'active' && !entry.locked;
          return (
            <TokenBox
              key={entry.id}
              token={token}
              isCurrent={isCurrent}
              isUnlocked={isUnlocked}
              opacity={opacity}
              onClick={isCurrent ? onAdvanceTurn : undefined}
              onDoubleClick={() => onTokenStatsRequest(token)}
              boxRef={isCurrent ? (el) => (currentTokenRef.current = el) : undefined}
            />
          );
        })}
      </Box>
    </Paper>
  );
}

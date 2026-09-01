import { useEffect, useRef, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import type Konva from 'konva';
import useImage from 'use-image';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Fab from '@mui/material/Fab';
import Tooltip from '@mui/material/Tooltip';
import Snackbar from '@mui/material/Snackbar';
import Alert from '@mui/material/Alert';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import { AppShell } from '../components/layout/AppShell';
import { Breadcrumbs } from '../components/layout/Breadcrumbs';
import { MapCanvas } from '../components/map/MapCanvas';
import { InitiativeBar } from '../components/map/InitiativeBar';
import { MapSidebar } from '../components/map/sidebar/MapSidebar';
import { MapToolbar } from '../components/map/toolbar/MapToolbar';
import { TokenManagerPopover, type TokenManagerTab } from '../components/map/toolbar/TokenManagerPopover';
import { CreatureStatBlockDialog } from '../components/dm/CreatureStatBlockDialog';
import { ShortcutQuickBar } from '../components/map/ShortcutQuickBar';
import { MapNumberInputPopover } from '../components/map/MapNumberInputPopover';
import { MapTextInputPopover } from '../components/map/MapTextInputPopover';
import { ShortcutsSettingsDialog } from '../components/settings/ShortcutsSettingsDialog';
import { useCampaignStore, getCampaignById, getMapsForCampaign } from '../store/useCampaignStore';
import { useWorldStore, getWorldById } from '../store/useWorldStore';
import { useNavMemoryStore } from '../store/useNavMemoryStore';
import { useTokenLibraryStore } from '../store/useTokenLibraryStore';
import { useTokenManagerUiStore } from '../store/useTokenManagerUiStore';
import { useEncounterStore, getEncountersForCampaign } from '../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../store/useCreatureStore';
import { useShortcutStore, getEffectiveCombo } from '../store/useShortcutStore';
import { apiMapShapeToAoEShape, apiMapTokenToPlacedToken, applyApiFloorMetaPatch } from '../api/adapters';
import { connectRoom, floorRoom } from '../api/ws';
import type { ApiMapFloor, ApiMapShape, ApiMapToken } from '../api/types';
import { getPrimaryFloor, type GridType, type MapFloor } from '../types/map';
import {
  DEFAULT_TOKEN_HP,
  DEFAULT_TOKEN_OUTLINE_COLOR,
  DEFAULT_TOKEN_SIZE,
  MAX_TOKEN_SIZE,
  MIN_TOKEN_SIZE,
  type PlacedToken,
} from '../types/token';
import { DEFAULT_MARKER_WIDTH, DEFAULT_SHAPE_COLOR, type AoEShape } from '../types/shape';
import { DEFAULT_INITIATIVE_STATE, type InitiativeEntry } from '../types/initiative';
import { abilityModifier, getCreatureRelationOption, type Creature } from '../types/creature';
import type { Encounter, EncounterCreatureEntry } from '../types/encounter';
import type { MapToolMode } from '../types/tool';
import type { StagePoint } from '../utils/tokenDrag';
import { computeBestFitRotation, type MapRotation } from '../utils/mapFit';
import { SHORTCUT_ACTIONS, comboFromKeyboardEvent, formatCombo } from '../types/shortcut';

const ZOOM_STEP = 1.2;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

type QuickInputPopoverState =
  | { kind: 'damage' | 'heal' | 'tempHp'; targetIds: string[] }
  | { kind: 'tag'; targetIds: string[] }
  | { kind: 'rename' | 'notes'; targetId: string; initialValue: string }
  | null;

/** Fixed, viewport-relative anchor for the hotkey-triggered quick-action popovers - there's no
 * meaningful click point to anchor to when a popover is opened from a keyboard shortcut. */
const QUICK_POPOVER_ANCHOR = () => ({ top: Math.round(window.innerHeight * 0.3), left: Math.round(window.innerWidth / 2) });

export function MapPage() {
  const { campaignId, mapId } = useParams<{ campaignId: string; mapId: string }>();
  const campaigns = useCampaignStore((state) => state.campaigns);
  const campaignsLoaded = useCampaignStore((state) => state.campaignsLoaded);
  const fetchCampaigns = useCampaignStore((state) => state.fetchCampaigns);
  const mapsByCampaignId = useCampaignStore((state) => state.mapsByCampaignId);
  const mapsLoadedByCampaignId = useCampaignStore((state) => state.mapsLoadedByCampaignId);
  const fetchMapsForCampaign = useCampaignStore((state) => state.fetchMapsForCampaign);
  const updateFloorInMap = useCampaignStore((state) => state.updateFloorInMap);
  const updateMapInCampaign = useCampaignStore((state) => state.updateMapInCampaign);
  const applyRemoteFloorPatch = useCampaignStore((state) => state.applyRemoteFloorPatch);
  const tokenLibrary = useTokenLibraryStore((state) => state.tokens);
  const fetchTokenLibrary = useTokenLibraryStore((state) => state.fetchTokenLibrary);

  const encountersByCampaignId = useEncounterStore((state) => state.encountersByCampaignId);
  const fetchEncountersForCampaign = useEncounterStore((state) => state.fetchEncountersForCampaign);
  const creaturesByCampaignId = useCreatureStore((state) => state.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((state) => state.fetchCreaturesForCampaign);
  const creatureBrowse = useCreatureStore((state) => state.creatureBrowse);
  const creaturePickerBrowse = useCreatureStore((state) => state.creaturePickerBrowse);

  const [activeFloorId, setActiveFloorId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeTool, setActiveTool] = useState<MapToolMode>('select');
  const [shapeColor, setShapeColor] = useState(DEFAULT_SHAPE_COLOR);
  const [markerWidth, setMarkerWidth] = useState(DEFAULT_MARKER_WIDTH);
  const [tokenManagerOpen, setTokenManagerOpen] = useState(false);
  const [tokenManagerAnchor, setTokenManagerAnchor] = useState<HTMLElement | null>(null);
  const [tokenManagerPosition, setTokenManagerPosition] = useState<{ top: number; left: number } | null>(null);
  const [tokenManagerFocusId, setTokenManagerFocusId] = useState<string | null>(null);
  const [tokenManagerTab, setTokenManagerTab] = useState<TokenManagerTab>('floor');
  const [fitResetEpoch, setFitResetEpoch] = useState(0);
  const [statsCreature, setStatsCreature] = useState<Creature | null>(null);
  const [noStatsWarning, setNoStatsWarning] = useState(false);
  const [undoStack, setUndoStack] = useState<MapFloor[]>([]);
  const [redoStack, setRedoStack] = useState<MapFloor[]>([]);
  const [selectedTokenIds, setSelectedTokenIds] = useState<string[]>([]);
  const [shortcutsDialogOpen, setShortcutsDialogOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [quickInputPopover, setQuickInputPopover] = useState<QuickInputPopoverState>(null);

  const shortcutOverrides = useShortcutStore((state) => state.overrides);

  const stageRef = useRef<Konva.Stage>(null);
  const keyHandlersRef = useRef<{ undo: () => void; redo: () => void; blocked: boolean; shortcuts: Record<string, () => void> }>(
    { undo: () => {}, redo: () => {}, blocked: false, shortcuts: {} },
  );

  const campaign = getCampaignById(campaigns, campaignId);
  const maps = getMapsForCampaign(mapsByCampaignId, campaignId);
  const map = maps.find((m) => m.id === mapId);
  const mapsLoaded = campaignId ? !!mapsLoadedByCampaignId[campaignId] : false;
  const worlds = useWorldStore((state) => state.worlds);
  const setLastVisitedMap = useNavMemoryStore((state) => state.setLastVisitedMap);
  const setLastLocation = useNavMemoryStore((state) => state.setLastLocation);

  useEffect(() => {
    if (!campaign || !map) return;
    setLastVisitedMap({
      worldId: campaign.worldId,
      campaignId: campaign.id,
      mapId: map.id,
      mapName: map.name,
      campaignName: campaign.name,
      visitedAt: Date.now(),
    });
    setLastLocation({
      worldId: campaign.worldId,
      worldName: getWorldById(worlds, campaign.worldId)?.name ?? campaign.name,
      campaignId: campaign.id,
      campaignName: campaign.name,
      path: `/w/${campaign.worldId}/c/${campaign.id}/maps/${map.id}`,
      sectionLabel: 'Maps',
      visitedAt: Date.now(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?.id, map?.id]);
  const activeFloor = map
    ? (map.floors.find((f) => f.id === activeFloorId) ?? getPrimaryFloor(map) ?? map.floors[0])
    : undefined;
  // Shares use-image's internal cache with MapBackgroundLayer's own useImage(src) call for
  // the same URL, so this doesn't trigger a second fetch - just gives Reset View access to
  // the image's natural (unscaled) dimensions to compute the best-fit rotation.
  const [backgroundImage] = useImage(activeFloor?.imageSrc ?? '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // While a dialog/popover with its own text field is open (rename/tag/notes/bulk-apply
      // popovers, the shortcuts settings dialog), none of MapPage's own keyboard handling
      // should fire in the background - not just the new hotkeys, but also Escape/undo/redo,
      // which would otherwise silently reset the active tool or rewrite map history behind
      // an open dialog. MUI's focus trap doesn't reliably move document.activeElement into
      // the dialog's input, so this flag - not just an activeElement check - is what covers it.
      if (keyHandlersRef.current.blocked) return;

      if (e.key === 'Escape') {
        setActiveTool('select');
        return;
      }
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        keyHandlersRef.current.undo();
        return;
      }
      if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        keyHandlersRef.current.redo();
        return;
      }
      // Combat shortcuts (t/l/g/y/r/h/e/j/k/n/d and friends) - never fire while typing in any
      // text input elsewhere on the page.
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      const combo = comboFromKeyboardEvent(e);
      const handler = keyHandlersRef.current.shortcuts[combo];
      if (handler) {
        e.preventDefault();
        handler();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchCampaigns();
    fetchTokenLibrary();
  }, [fetchCampaigns, fetchTokenLibrary]);

  useEffect(() => {
    if (!campaignId) return;
    fetchMapsForCampaign(campaignId);
    fetchCreaturesForCampaign(campaignId);
    fetchEncountersForCampaign(campaignId);
  }, [campaignId, fetchMapsForCampaign, fetchCreaturesForCampaign, fetchEncountersForCampaign]);

  // Live sync: other clients' (or other tabs') REST edits to this floor's
  // tokens/shapes broadcast into its WS room - merge them into local state
  // without re-triggering our own persistence (applyRemoteFloorPatch skips
  // the sync step that updateFloorInMap does).
  useEffect(() => {
    if (!campaignId || !map?.id || !activeFloor?.id) return;
    const floorId = activeFloor.id;
    const mapId = map.id;
    const unsubscribe = connectRoom(floorRoom(floorId), (message) => {
      switch (message.type) {
        case 'token:created':
        case 'token:updated': {
          const token = apiMapTokenToPlacedToken(message.data as ApiMapToken);
          applyRemoteFloorPatch(campaignId, mapId, floorId, (floor) => ({
            ...floor,
            placedTokens: floor.placedTokens.some((t) => t.id === token.id)
              ? floor.placedTokens.map((t) => (t.id === token.id ? token : t))
              : [...floor.placedTokens, token],
          }));
          break;
        }
        case 'token:deleted': {
          const { id } = message.data as { id: string };
          applyRemoteFloorPatch(campaignId, mapId, floorId, (floor) => ({
            ...floor,
            placedTokens: floor.placedTokens.filter((t) => t.id !== id),
          }));
          break;
        }
        case 'shape:created': {
          const shape = apiMapShapeToAoEShape(message.data as ApiMapShape);
          applyRemoteFloorPatch(campaignId, mapId, floorId, (floor) =>
            floor.shapes.some((s) => s.id === shape.id) ? floor : { ...floor, shapes: [...floor.shapes, shape] },
          );
          break;
        }
        case 'shape:deleted': {
          const { id } = message.data as { id: string };
          applyRemoteFloorPatch(campaignId, mapId, floorId, (floor) => ({
            ...floor,
            shapes: floor.shapes.filter((s) => s.id !== id),
          }));
          break;
        }
        case 'floor:updated': {
          const data = message.data as ApiMapFloor;
          applyRemoteFloorPatch(campaignId, mapId, floorId, (floor) => applyApiFloorMetaPatch(floor, data));
          break;
        }
        default:
          break;
      }
    });
    return unsubscribe;
  }, [campaignId, map?.id, activeFloor?.id, applyRemoteFloorPatch]);

  if (!campaignId) {
    return <Navigate to="/dashboard" replace />;
  }

  if (!campaignsLoaded || !mapsLoaded) {
    return (
      <AppShell>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      </AppShell>
    );
  }

  if (!campaign || !map) {
    return <Navigate to={campaign ? `/w/${campaign.worldId}/c/${campaign.id}/maps` : '/dashboard'} replace />;
  }

  const mutateActiveFloor = (updater: (floor: typeof activeFloor) => typeof activeFloor) => {
    if (!activeFloor) return;
    updateFloorInMap(campaignId, map.id, activeFloor.id, updater as never);
  };

  const HISTORY_LIMIT = 50;

  /** Same as mutateActiveFloor, but records an undo step first (used only for edits the DM would plausibly want to undo). */
  const mutateActiveFloorWithHistory = (updater: (floor: typeof activeFloor) => typeof activeFloor) => {
    if (!activeFloor) return;
    setUndoStack((stack) => [...stack.slice(-HISTORY_LIMIT + 1), activeFloor]);
    setRedoStack([]);
    updateFloorInMap(campaignId, map.id, activeFloor.id, updater as never);
  };

  const handleUndo = () => {
    if (!activeFloor || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setUndoStack((stack) => stack.slice(0, -1));
    setRedoStack((stack) => [...stack.slice(-HISTORY_LIMIT + 1), activeFloor]);
    updateFloorInMap(campaignId, map.id, activeFloor.id, () => previous);
  };

  const handleRedo = () => {
    if (!activeFloor || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack((stack) => stack.slice(0, -1));
    setUndoStack((stack) => [...stack.slice(-HISTORY_LIMIT + 1), activeFloor]);
    updateFloorInMap(campaignId, map.id, activeFloor.id, () => next);
  };

  const resolvePlacementSize = (relativeSize: number): number =>
    Math.min(MAX_TOKEN_SIZE, Math.max(MIN_TOKEN_SIZE, relativeSize * DEFAULT_TOKEN_SIZE));

  const handleTokenMove = (tokenId: string, x: number, y: number) => {
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) => (t.id === tokenId ? { ...t, x, y } : t)),
    }));
  };

  /** Finds the creature stat block linked to a placed token - directly via token.creatureId
   * (favorites drop, encounter drop) or, for older placements that predate that field, via its
   * encounter entry. */
  const findLinkedCreature = (token: PlacedToken, creatures: Creature[], encounters: Encounter[]): Creature | undefined => {
    if (token.creatureId) return creatures.find((c) => c.id === token.creatureId);
    if (!token.encounterEntryId) return undefined;
    for (const enc of encounters) {
      const entry = enc.creatures.find((c) => c.id === token.encounterEntryId);
      if (entry) return entry.creatureId ? creatures.find((c) => c.id === entry.creatureId) : undefined;
    }
    return undefined;
  };

  /** Rolls a fresh initiative entry (d20 + DEX mod when linked to a creature) for one token. */
  const rollEntryForToken = (
    token: PlacedToken,
    creatures: Creature[],
    encounters: Encounter[],
    locked: boolean,
  ): InitiativeEntry => {
    const creature = findLinkedCreature(token, creatures, encounters);
    const modifier = creature ? abilityModifier(creature.abilities.dex) : 0;
    const baseRoll = Math.ceil(Math.random() * 20);
    return { id: crypto.randomUUID(), tokenId: token.id, baseRoll, modifier, roll: baseRoll + modifier, locked };
  };

  /**
   * Adds a newly-placed token to the floor. If an encounter is already active, also rolls
   * initiative for it immediately (left unlocked, since the DM may want to adjust it).
   */
  const addTokenAndMaybeRollInitiative = (floor: MapFloor, placed: PlacedToken): MapFloor => {
    const nextTokens = [...floor.placedTokens, placed];
    if (floor.initiative.status !== 'active' && floor.initiative.status !== 'rolling') {
      return { ...floor, placedTokens: nextTokens };
    }
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    // While still rolling (pre Start Encounter), leave the entry unlocked like the rest -
    // Start Encounter locks everything at once. Mid-encounter additions also start unlocked.
    const newEntry = rollEntryForToken(placed, creatures, encounters, false);
    return {
      ...floor,
      placedTokens: nextTokens,
      initiative: { ...floor.initiative, entries: [...floor.initiative.entries, newEntry] },
    };
  };

  const handleDropToken = (tokenDefId: string, point: StagePoint) => {
    const tokenDef = tokenLibrary.find((t) => t.id === tokenDefId);
    if (!tokenDef) return;
    const placed: PlacedToken = {
      id: crypto.randomUUID(),
      tokenId: tokenDef.id,
      name: tokenDef.name,
      imageSrc: tokenDef.imageSrc,
      x: point.x,
      y: point.y,
      size: resolvePlacementSize(tokenDef.currentSize),
      outlineColor: DEFAULT_TOKEN_OUTLINE_COLOR,
      effects: [],
      hp: { current: DEFAULT_TOKEN_HP, max: DEFAULT_TOKEN_HP },
    };
    mutateActiveFloorWithHistory((floor) => addTokenAndMaybeRollInitiative(floor!, placed));
  };

  const handleDropEncounterCreature = (entryId: string, point: StagePoint) => {
    const encounterId = activeFloor?.lockedEncounterId;
    if (!encounterId) return;
    const encounter = getEncountersForCampaign(encountersByCampaignId, campaignId).find((e) => e.id === encounterId);
    // Random-table encounters place from the roll flow's resolved roster (per-instance, not
    // saved back to the encounter's reusable tables); fixed encounters use their own roster.
    const roster = encounter?.resolutionType === 'random_table' ? (activeFloor?.resolvedEncounterRoster ?? []) : encounter?.creatures;
    const entry = roster?.find((c) => c.id === entryId);
    if (!entry) return;
    const placedCount = (activeFloor?.placedTokens ?? []).filter((t) => t.encounterEntryId === entryId).length;
    if (placedCount >= entry.quantity) return;
    const linkedCreature = entry.creatureId
      ? getCreaturesForCampaign(creaturesByCampaignId, campaignId).find((c) => c.id === entry.creatureId)
      : undefined;
    const relativeSize = linkedCreature?.currentSize ?? entry.size ?? 1;
    const maxHp = linkedCreature?.hp ?? DEFAULT_TOKEN_HP;
    const placed: PlacedToken = {
      id: crypto.randomUUID(),
      tokenId: entry.creatureId ?? entry.id,
      name: entry.name,
      imageSrc: entry.imageSrc,
      x: point.x,
      y: point.y,
      size: resolvePlacementSize(relativeSize),
      outlineColor: DEFAULT_TOKEN_OUTLINE_COLOR,
      effects: [],
      encounterEntryId: entry.id,
      creatureId: linkedCreature?.id,
      hp: { current: maxHp, max: maxHp },
    };
    mutateActiveFloorWithHistory((floor) => addTokenAndMaybeRollInitiative(floor!, placed));
  };

  /** Drags a monster/NPC straight from the toolbar's Favorites tab or the map sidebar's Tokens
   * panel onto the map - same shape as handleDropEncounterCreature, minus the encounter roster
   * bookkeeping. The sidebar's Tokens panel now lists the full own-or-global creature catalog
   * (not just this campaign's own creatures), so a dropped creature may only be resolvable via
   * the paginated `creatureBrowse` results it was rendered from, not `creaturesByCampaignId`. */
  const handleDropFavoriteCreature = (creatureId: string, point: StagePoint) => {
    const creature =
      getCreaturesForCampaign(creaturesByCampaignId, campaignId).find((c) => c.id === creatureId) ??
      creatureBrowse?.items.find((c) => c.id === creatureId);
    if (!creature) return;
    const maxHp = creature.hp || DEFAULT_TOKEN_HP;
    const placed: PlacedToken = {
      id: crypto.randomUUID(),
      tokenId: creature.id,
      name: creature.name,
      imageSrc: creature.tokenImage,
      x: point.x,
      y: point.y,
      size: resolvePlacementSize(creature.currentSize),
      outlineColor: DEFAULT_TOKEN_OUTLINE_COLOR,
      effects: [],
      creatureId: creature.id,
      hp: { current: maxHp, max: maxHp },
    };
    mutateActiveFloorWithHistory((floor) => addTokenAndMaybeRollInitiative(floor!, placed));
  };

  const handleLockEncounter = (encounterId: string | null) => {
    // Clear any previously-rolled roster whenever the locked encounter changes (including
    // unlocking) - a fresh lock always starts a fresh roll for a random-table encounter.
    mutateActiveFloor((floor) => ({ ...floor!, lockedEncounterId: encounterId, resolvedEncounterRoster: null }));
  };

  const handleSetResolvedEncounterRoster = (roster: EncounterCreatureEntry[] | null) => {
    mutateActiveFloor((floor) => ({ ...floor!, resolvedEncounterRoster: roster }));
  };

  const handleRollInitiative = () => {
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    const entries: InitiativeEntry[] = (activeFloor?.placedTokens ?? []).map((token) =>
      rollEntryForToken(token, creatures, encounters, false),
    );
    mutateActiveFloor((floor) => ({
      ...floor!,
      initiative: { status: 'rolling', entries, currentEntryId: null, round: 1 },
    }));
  };

  const handleCancelRoll = () => {
    mutateActiveFloor((floor) => ({ ...floor!, initiative: { ...DEFAULT_INITIATIVE_STATE, entries: [] } }));
  };

  const handleUpdateBaseRoll = (entryId: string, baseRoll: number) => {
    mutateActiveFloor((floor) => ({
      ...floor!,
      initiative: {
        ...floor!.initiative,
        entries: floor!.initiative.entries.map((e) =>
          e.id === entryId && !(floor!.initiative.status === 'active' && e.locked)
            ? { ...e, baseRoll, roll: baseRoll + e.modifier }
            : e,
        ),
      },
    }));
  };

  const handleToggleEntryLock = (entryId: string) => {
    mutateActiveFloor((floor) => ({
      ...floor!,
      initiative: {
        ...floor!.initiative,
        entries: floor!.initiative.entries.map((e) => (e.id === entryId ? { ...e, locked: !e.locked } : e)),
      },
    }));
  };

  const handleStartEncounter = () => {
    mutateActiveFloor((floor) => {
      const sorted = [...floor!.initiative.entries].sort((a, b) => (b.roll ?? 0) - (a.roll ?? 0));
      return {
        ...floor!,
        initiative: {
          ...floor!.initiative,
          status: 'active',
          currentEntryId: sorted[0]?.id ?? null,
          round: 1,
          // locking every entry is the whole point of Start Encounter - from here on the DM
          // must explicitly unlock a row before editing its initiative
          entries: floor!.initiative.entries.map((e) => ({ ...e, locked: true })),
        },
      };
    });
  };

  const handleNextTurn = () => {
    mutateActiveFloor((floor) => {
      const sorted = [...floor!.initiative.entries].sort((a, b) => (b.roll ?? 0) - (a.roll ?? 0));
      if (sorted.length === 0) return floor!;
      const currentIndex = sorted.findIndex((e) => e.id === floor!.initiative.currentEntryId);
      const nextIndex = (currentIndex + 1) % sorted.length;
      const wrapped = nextIndex === 0;
      return {
        ...floor!,
        initiative: {
          ...floor!.initiative,
          currentEntryId: sorted[nextIndex]?.id ?? null,
          round: wrapped ? floor!.initiative.round + 1 : floor!.initiative.round,
        },
      };
    });
  };

  const handleEndEncounter = () => {
    mutateActiveFloor((floor) => ({ ...floor!, initiative: { ...DEFAULT_INITIATIVE_STATE, entries: [] } }));
  };

  const handlePreviousTurn = () => {
    mutateActiveFloor((floor) => {
      const sorted = [...floor!.initiative.entries].sort((a, b) => (b.roll ?? 0) - (a.roll ?? 0));
      if (sorted.length === 0) return floor!;
      const currentIndex = sorted.findIndex((e) => e.id === floor!.initiative.currentEntryId);
      const wrapped = currentIndex <= 0;
      const prevIndex = wrapped ? sorted.length - 1 : currentIndex - 1;
      return {
        ...floor!,
        initiative: {
          ...floor!.initiative,
          currentEntryId: sorted[prevIndex]?.id ?? null,
          round: wrapped ? Math.max(1, floor!.initiative.round - 1) : floor!.initiative.round,
        },
      };
    });
  };

  /** Wipes every placed token off the floor and resets initiative to idle - Improved
   * Initiative's "Clear Encounter". */
  const handleClearEncounter = () => {
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: [],
      initiative: { ...DEFAULT_INITIATIVE_STATE, entries: [] },
    }));
    setSelectedTokenIds([]);
  };

  /** Removes only the downed (hp.current <= 0) tokens and their initiative entries - Improved
   * Initiative's "Clean Encounter". */
  const handleCleanEncounter = () => {
    const deadIds = (activeFloor?.placedTokens ?? []).filter((t) => !!t.hp && t.hp.current <= 0).map((t) => t.id);
    handleDeleteFloorTokens(deadIds);
  };

  /** Restores every token linked to a "Player" creature to full HP - Improved Initiative's
   * "Restore all Player Character HP". */
  const handleRestoreAllPcHp = () => {
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) => {
        if (!t.hp) return t;
        const creature = findLinkedCreature(t, creatures, encounters);
        if (creature?.relation !== 'player') return t;
        return { ...t, hp: { current: t.hp.max, max: t.hp.max } };
      }),
    }));
  };

  const handleUpdateFloorToken = (
    tokenId: string,
    changes: Partial<
      Pick<
        PlacedToken,
        | 'name'
        | 'size'
        | 'outlineColor'
        | 'effects'
        | 'hp'
        | 'tempHp'
        | 'concentrating'
        | 'reactionSpent'
        | 'deathSaves'
        | 'notes'
      >
    >,
  ) => {
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) => (t.id === tokenId ? { ...t, ...changes } : t)),
    }));
  };

  /** Deletes one or more placed tokens AND prunes their matching InitiativeEntry rows - the
   * single-token delete path (right-click > delete) previously left orphaned entries behind,
   * silently tolerated by InitiativeBar/InitiativePanel's own tokenById filtering but never
   * actually cleaned up; "Remove from Encounter" hotkey makes that gap visible, so it's fixed
   * here for both callers. */
  const handleDeleteFloorTokens = (tokenIds: string[]) => {
    if (tokenIds.length === 0) return;
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.filter((t) => !tokenIds.includes(t.id)),
      initiative: {
        ...floor!.initiative,
        entries: floor!.initiative.entries.filter((e) => !tokenIds.includes(e.tokenId)),
      },
    }));
    setSelectedTokenIds((prev) => prev.filter((id) => !tokenIds.includes(id)));
  };

  const handleDeleteFloorToken = (tokenId: string) => handleDeleteFloorTokens([tokenId]);

  const handleTokenContextMenu = (token: PlacedToken, clientX: number, clientY: number) => {
    setTokenManagerAnchor(null);
    setTokenManagerPosition({ top: clientY, left: clientX });
    setTokenManagerFocusId(token.id);
    setTokenManagerTab('floor');
    setTokenManagerOpen(true);
  };

  const handleOpenTokenManager = (anchorEl: HTMLElement) => {
    setTokenManagerPosition(null);
    setTokenManagerAnchor(anchorEl);
    setTokenManagerFocusId(null);
    // Restore whichever tab (This Floor/Favorites/Encounters) the DM was last on, rather
    // than always resetting to 'floor' - right-clicking a specific token still forces
    // 'floor' below, since that's a deliberate jump to that token's row.
    setTokenManagerTab(useTokenManagerUiStore.getState().lastTab);
    setTokenManagerOpen(true);
  };

  const handleShapeComplete = (shape: AoEShape) => {
    mutateActiveFloorWithHistory((floor) => ({ ...floor!, shapes: [...floor!.shapes, shape] }));
  };

  const handleEraseShape = (shapeId: string) => {
    mutateActiveFloorWithHistory((floor) => ({ ...floor!, shapes: floor!.shapes.filter((s) => s.id !== shapeId) }));
  };

  const handleToggleGrid = () => {
    updateMapInCampaign(campaignId, { ...map, gridEnabled: !map.gridEnabled });
  };

  const handleGridSizeChange = (size: number) => {
    updateMapInCampaign(campaignId, { ...map, gridSize: size });
  };

  const handleGridColorChange = (color: string) => {
    updateMapInCampaign(campaignId, { ...map, gridColor: color });
  };

  const handleGridThicknessChange = (thickness: number) => {
    updateMapInCampaign(campaignId, { ...map, gridThickness: thickness });
  };

  const handleGridTypeChange = (type: GridType) => {
    updateMapInCampaign(campaignId, { ...map, gridType: type });
  };

  const handleFlipHorizontal = () => {
    mutateActiveFloorWithHistory((floor) => ({ ...floor!, flippedHorizontal: !floor!.flippedHorizontal }));
  };

  const handleFlipVertical = () => {
    mutateActiveFloorWithHistory((floor) => ({ ...floor!, flippedVertical: !floor!.flippedVertical }));
  };

  const handleRotate = () => {
    mutateActiveFloorWithHistory((floor) => ({ ...floor!, rotation: ((floor!.rotation ?? 0) + 90) % 360 }));
  };

  /** Same linkage as findLinkedCreature, but also falls back through the paginated/global
   * caches (creatureBrowse, creaturePickerBrowse) and, as a last resort, an on-demand fetch -
   * a token dropped from the global/compendium catalog carries a valid creatureId that may
   * only be resolvable there, not in creaturesByCampaignId (see handleDropFavoriteCreature). */
  const handleTokenStatsRequest = async (token: PlacedToken) => {
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    const cached =
      findLinkedCreature(token, creatures, encounters) ??
      (token.creatureId
        ? (creatureBrowse?.items.find((c) => c.id === token.creatureId) ??
          creaturePickerBrowse?.items.find((c) => c.id === token.creatureId) ??
          useCreatureStore.getState().creaturesById[token.creatureId])
        : undefined);
    if (cached) {
      setStatsCreature(cached);
      return;
    }
    if (token.creatureId) {
      const fetched = await useCreatureStore.getState().fetchCreatureById(token.creatureId);
      if (fetched) {
        setStatsCreature(fetched);
        return;
      }
    }
    setNoStatsWarning(true);
  };

  // -----------------------------------------------------------------------
  // Multi-select + combatant hotkey actions
  // -----------------------------------------------------------------------

  const handleTokenSelect = (token: PlacedToken, additive: boolean) => {
    setSelectedTokenIds((prev) => {
      if (additive) return prev.includes(token.id) ? prev.filter((id) => id !== token.id) : [...prev, token.id];
      return [token.id];
    });
  };

  const handleClearSelection = () => setSelectedTokenIds([]);

  /** Combatant-hotkey target resolution: the current selection, falling back to whoever's
   * turn it currently is (Improved Initiative's own default when nothing is selected). */
  const getActionTargetIds = (): string[] => {
    if (selectedTokenIds.length > 0) return selectedTokenIds;
    const currentEntry = activeFloor?.initiative.entries.find((e) => e.id === activeFloor.initiative.currentEntryId);
    return currentEntry ? [currentEntry.tokenId] : [];
  };

  /** Applies one numeric amount to every target at once, in a single history step so undo is
   * atomic across the whole bulk edit. Damage depletes tempHp before hp.current, per 5e rules. */
  const applyBulkHp = (targetIds: string[], kind: 'damage' | 'heal' | 'tempHp', amount: number) => {
    if (targetIds.length === 0 || !(amount > 0)) return;
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) => {
        if (!targetIds.includes(t.id)) return t;
        if (kind === 'tempHp') return { ...t, tempHp: amount };
        const hp = t.hp ?? { current: 0, max: 0 };
        if (kind === 'heal') return { ...t, hp: { current: Math.min(hp.max, hp.current + amount), max: hp.max } };
        const temp = t.tempHp ?? 0;
        const remaining = Math.max(0, amount - temp);
        return { ...t, tempHp: Math.max(0, temp - amount), hp: { current: hp.current - remaining, max: hp.max } };
      }),
    }));
  };

  const handleAddTag = (targetIds: string[], tag: string) => {
    const trimmed = tag.trim();
    if (!trimmed || targetIds.length === 0) return;
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) =>
        targetIds.includes(t.id) && !t.effects.includes(trimmed) ? { ...t, effects: [...t.effects, trimmed] } : t,
      ),
    }));
  };

  const handleToggleSpentReaction = (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) =>
        targetIds.includes(t.id) ? { ...t, reactionSpent: !t.reactionSpent } : t,
      ),
    }));
  };

  const handleSelectRelative = (direction: 1 | -1) => {
    const tokens = activeFloor?.placedTokens ?? [];
    if (tokens.length === 0) return;
    const currentId = selectedTokenIds[0];
    const currentIndex = currentId ? tokens.findIndex((t) => t.id === currentId) : -1;
    const nextIndex = currentIndex === -1 ? 0 : (currentIndex + direction + tokens.length) % tokens.length;
    setSelectedTokenIds([tokens[nextIndex].id]);
  };

  const handleDuplicateCombatants = (targetIds: string[]) => {
    if (targetIds.length === 0) return;
    const newIds: string[] = [];
    mutateActiveFloorWithHistory((floor) => {
      let next = floor!;
      for (const id of targetIds) {
        const original = next.placedTokens.find((t) => t.id === id);
        if (!original) continue;
        const clone: PlacedToken = { ...original, id: crypto.randomUUID(), x: original.x + 24, y: original.y + 24 };
        newIds.push(clone.id);
        next = addTokenAndMaybeRollInitiative(next, clone);
      }
      return next;
    });
    if (newIds.length > 0) setSelectedTokenIds(newIds);
  };

  // Hotkey entry points for the small quick-input popovers (damage/heal/tempHp/tag/rename/notes)
  const handleApplyDamageHotkey = () => {
    const ids = getActionTargetIds();
    if (ids.length > 0) setQuickInputPopover({ kind: 'damage', targetIds: ids });
  };
  const handleApplyHealingHotkey = () => {
    const ids = getActionTargetIds();
    if (ids.length > 0) setQuickInputPopover({ kind: 'heal', targetIds: ids });
  };
  const handleApplyTempHpHotkey = () => {
    const ids = getActionTargetIds();
    if (ids.length > 0) setQuickInputPopover({ kind: 'tempHp', targetIds: ids });
  };
  const handleAddTagHotkey = () => {
    const ids = getActionTargetIds();
    if (ids.length > 0) setQuickInputPopover({ kind: 'tag', targetIds: ids });
  };
  const handleRenameHotkey = () => {
    if (selectedTokenIds.length !== 1) return;
    const token = activeFloor?.placedTokens.find((t) => t.id === selectedTokenIds[0]);
    if (token) setQuickInputPopover({ kind: 'rename', targetId: token.id, initialValue: token.name });
  };
  const handleNotesHotkey = () => {
    if (selectedTokenIds.length !== 1) return;
    const token = activeFloor?.placedTokens.find((t) => t.id === selectedTokenIds[0]);
    if (token) setQuickInputPopover({ kind: 'notes', targetId: token.id, initialValue: token.notes ?? '' });
  };
  const handleQuickEditHotkey = () => {
    const ids = getActionTargetIds();
    if (ids.length !== 1) return;
    setTokenManagerAnchor(null);
    setTokenManagerPosition(QUICK_POPOVER_ANCHOR());
    setTokenManagerFocusId(ids[0]);
    setTokenManagerTab('floor');
    setTokenManagerOpen(true);
  };

  const zoomBy = (factor: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const oldScale = stage.scaleX();
    const newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, oldScale * factor));
    const center = { x: stage.width() / 2, y: stage.height() / 2 };
    const pointTo = { x: (center.x - stage.x()) / oldScale, y: (center.y - stage.y()) / oldScale };
    stage.scale({ x: newScale, y: newScale });
    stage.position({ x: center.x - pointTo.x * newScale, y: center.y - pointTo.y * newScale });
    stage.batchDraw();
  };

  const handleResetView = () => {
    const stage = stageRef.current;
    if (!stage || !activeFloor || !backgroundImage) return;
    // Read the live, fullscreen-aware viewport size directly off the Stage (its width/height
    // props already come from useResponsiveStageSize's ResizeObserver, so this reflects an F11
    // toggle or the browser chrome hiding without any extra plumbing).
    const viewportW = stage.width();
    const viewportH = stage.height();
    const { rotation } = computeBestFitRotation(viewportW, viewportH, backgroundImage.width, backgroundImage.height);

    if (rotation !== ((activeFloor.rotation ?? 0) as MapRotation)) {
      mutateActiveFloorWithHistory((floor) => ({ ...floor!, rotation }));
    }
    // Force MapBackgroundLayer/MapCanvas's frozen fit + rotate pivot to recompute against
    // the current viewport and the (possibly just-changed) rotation above - see
    // MapBackgroundLayer's fitResetEpoch doc comment for why this doesn't happen on every
    // render/resize. Once that recompute lands, the background layer itself best-fits the
    // viewport, so the Stage-level transform just resets to identity on top of it.
    setFitResetEpoch((e) => e + 1);
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    stage.batchDraw();
  };

  /** Placed tokens enriched with render-only fields the map/initiative bar need but that are
   * never persisted: which token is acting right now (golden highlight) and, for tokens linked
   * to a favorited "Player" creature, a relation tint - both derived here from state that's
   * already in scope rather than threaded as separate props through Konva/the initiative bar. */
  const mapTokens: PlacedToken[] = (activeFloor?.placedTokens ?? []).map((token) => {
    const creature = findLinkedCreature(
      token,
      getCreaturesForCampaign(creaturesByCampaignId, campaignId),
      getEncountersForCampaign(encountersByCampaignId, campaignId),
    );
    const currentEntry = activeFloor?.initiative.entries.find((e) => e.id === activeFloor.initiative.currentEntryId);
    return {
      ...token,
      relationTint: creature ? getCreatureRelationOption(creature.relation).tint : undefined,
      isCurrentTurn: activeFloor?.initiative.status === 'active' && currentEntry?.tokenId === token.id,
      ac: creature?.ac,
    };
  });

  const actionTargetIds = getActionTargetIds();

  const actionHandlers: Record<string, () => void> = {
    startEncounter: handleStartEncounter,
    rerollInitiative: handleRollInitiative,
    endEncounter: handleEndEncounter,
    clearEncounter: handleClearEncounter,
    cleanEncounter: handleCleanEncounter,
    restoreAllPcHp: handleRestoreAllPcHp,
    toggleFullScreen: () => setIsFullscreen((f) => !f),
    nextTurn: handleNextTurn,
    previousTurn: handlePreviousTurn,
    saveEncounter: () => setSavedToast(true),
    openSettings: () => setShortcutsDialogOpen(true),
    applyDamage: handleApplyDamageHotkey,
    applyHealing: handleApplyHealingHotkey,
    applyTempHp: handleApplyTempHpHotkey,
    addTag: handleAddTagHotkey,
    updatePersistentNotes: handleNotesHotkey,
    removeFromEncounter: () => handleDeleteFloorTokens(getActionTargetIds()),
    rename: handleRenameHotkey,
    toggleSpentReaction: () => handleToggleSpentReaction(getActionTargetIds()),
    quickEditCombatant: handleQuickEditHotkey,
    selectNext: () => handleSelectRelative(1),
    selectPrevious: () => handleSelectRelative(-1),
    duplicateCombatant: () => handleDuplicateCombatants(getActionTargetIds()),
  };

  const dispatchShortcutAction = (actionId: string) => actionHandlers[actionId]?.();

  const shortcutComboMap: Record<string, () => void> = {};
  for (const action of SHORTCUT_ACTIONS) {
    if (!action.wired) continue;
    const handler = actionHandlers[action.id];
    if (!handler) continue;
    shortcutComboMap[getEffectiveCombo(shortcutOverrides, action.id)] = handler;
  }

  keyHandlersRef.current = {
    undo: handleUndo,
    redo: handleRedo,
    blocked: tokenManagerOpen || shortcutsDialogOpen || !!quickInputPopover,
    shortcuts: shortcutComboMap,
  };

  return (
    <AppShell fullHeight disableGutters hideHeader={isFullscreen}>
      {!isFullscreen && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3 }}>
          <Breadcrumbs
            items={[
              { label: 'Dashboard', to: '/dashboard' },
              { label: campaign.name, to: `/w/${campaign.worldId}/c/${campaign.id}/home` },
              { label: 'Maps', to: `/w/${campaign.worldId}/c/${campaign.id}/maps` },
              { label: map.name },
            ]}
          />
          <Typography variant="h5" component="h1" noWrap sx={{ mb: 2, maxWidth: '80%' }}>
            {map.name}
          </Typography>
        </Box>
      )}

      <Stack direction="row" sx={{ flexGrow: 1, minHeight: 0 }}>
        <Stack sx={{ flexGrow: 1, minWidth: 0, position: 'relative', px: { xs: 2, sm: 3 }, pb: 2 }}>
          {activeFloor && (
            <MapCanvas
              stageRef={stageRef}
              backgroundImageSrc={activeFloor.imageSrc}
              tokens={mapTokens}
              onTokenMove={handleTokenMove}
              onTokenContextMenu={handleTokenContextMenu}
              onTokenStatsRequest={handleTokenStatsRequest}
              onTokenSelect={handleTokenSelect}
              selectedTokenIds={selectedTokenIds}
              onClearSelection={handleClearSelection}
              gridEnabled={map.gridEnabled}
              gridSize={map.gridSize}
              gridColor={map.gridColor}
              gridThickness={map.gridThickness}
              gridType={map.gridType}
              shapes={activeFloor.shapes}
              activeTool={activeTool}
              shapeColor={shapeColor}
              markerWidth={markerWidth}
              onShapeComplete={handleShapeComplete}
              onEraseShape={handleEraseShape}
              onDropToken={handleDropToken}
              onDropEncounterCreature={handleDropEncounterCreature}
              onDropFavoriteCreature={handleDropFavoriteCreature}
              flippedHorizontal={activeFloor.flippedHorizontal}
              flippedVertical={activeFloor.flippedVertical}
              rotation={activeFloor.rotation}
              fitResetEpoch={fitResetEpoch}
            />
          )}
          {activeFloor && (
            <Box
              sx={{
                position: 'absolute',
                top: 16,
                left: 0,
                right: 0,
                display: 'flex',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <InitiativeBar
                placedTokens={mapTokens}
                initiative={activeFloor.initiative}
                onAdvanceTurn={handleNextTurn}
                onTokenStatsRequest={handleTokenStatsRequest}
              />
            </Box>
          )}
          {activeFloor && (
            <Box sx={{ position: 'absolute', top: 16, right: 16, pointerEvents: 'none' }}>
              <ShortcutQuickBar
                overrides={shortcutOverrides}
                hasTarget={actionTargetIds.length > 0}
                onAction={dispatchShortcutAction}
              />
            </Box>
          )}
          <Box
            sx={{
              position: 'absolute',
              bottom: 16,
              left: 0,
              right: 0,
              display: 'flex',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}
          >
            <MapToolbar
              gridEnabled={map.gridEnabled}
              gridSize={map.gridSize}
              gridColor={map.gridColor}
              gridThickness={map.gridThickness}
              gridType={map.gridType}
              onToggleGrid={handleToggleGrid}
              onGridSizeChange={handleGridSizeChange}
              onGridColorChange={handleGridColorChange}
              onGridThicknessChange={handleGridThicknessChange}
              onGridTypeChange={handleGridTypeChange}
              onZoomIn={() => zoomBy(ZOOM_STEP)}
              onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
              onResetView={handleResetView}
              activeTool={activeTool}
              onSelectTool={setActiveTool}
              shapeColor={shapeColor}
              onShapeColorChange={setShapeColor}
              markerWidth={markerWidth}
              onMarkerWidthChange={setMarkerWidth}
              flippedHorizontal={!!activeFloor?.flippedHorizontal}
              flippedVertical={!!activeFloor?.flippedVertical}
              onFlipHorizontal={handleFlipHorizontal}
              onFlipVertical={handleFlipVertical}
              onRotate={handleRotate}
              canUndo={undoStack.length > 0}
              canRedo={redoStack.length > 0}
              onUndo={handleUndo}
              onRedo={handleRedo}
              onOpenTokenManager={handleOpenTokenManager}
            />
          </Box>
        </Stack>

        <MapSidebar
          campaignId={campaignId}
          floors={map.floors}
          activeFloorId={activeFloor?.id ?? ''}
          onSelectFloor={setActiveFloorId}
          placedTokens={mapTokens}
          initiative={activeFloor?.initiative ?? DEFAULT_INITIATIVE_STATE}
          onRollInitiative={handleRollInitiative}
          onCancelRoll={handleCancelRoll}
          onUpdateBaseRoll={handleUpdateBaseRoll}
          onToggleEntryLock={handleToggleEntryLock}
          onStartEncounter={handleStartEncounter}
          onNextTurn={handleNextTurn}
          onEndEncounter={handleEndEncounter}
          onUpdateToken={handleUpdateFloorToken}
          selectedTokenIds={selectedTokenIds}
          onTokenSelect={handleTokenSelect}
          shortcutOverrides={shortcutOverrides}
        />
      </Stack>

      <Tooltip
        title={`${isFullscreen ? 'Exit fullscreen' : 'Fullscreen map'} (${formatCombo(getEffectiveCombo(shortcutOverrides, 'toggleFullScreen'))})`}
      >
        <Fab
          size="medium"
          onClick={() => setIsFullscreen((f) => !f)}
          sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: (theme) => theme.zIndex.fab }}
        >
          {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
        </Fab>
      </Tooltip>

      <TokenManagerPopover
        open={tokenManagerOpen}
        anchorEl={tokenManagerAnchor}
        anchorPosition={tokenManagerPosition}
        onClose={() => setTokenManagerOpen(false)}
        placedTokens={activeFloor?.placedTokens ?? []}
        onUpdateToken={handleUpdateFloorToken}
        onDeleteToken={handleDeleteFloorToken}
        focusTokenId={tokenManagerFocusId}
        initialTab={tokenManagerTab}
        campaignId={campaignId}
        lockedEncounterId={activeFloor?.lockedEncounterId}
        onLockEncounter={handleLockEncounter}
        resolvedEncounterRoster={activeFloor?.resolvedEncounterRoster ?? null}
        onSetResolvedEncounterRoster={handleSetResolvedEncounterRoster}
        encounterActive={activeFloor?.initiative.status === 'active'}
      />

      <CreatureStatBlockDialog open={!!statsCreature} creature={statsCreature} onClose={() => setStatsCreature(null)} />

      <Snackbar open={noStatsWarning} autoHideDuration={3000} onClose={() => setNoStatsWarning(false)}>
        <Alert severity="warning" onClose={() => setNoStatsWarning(false)} sx={{ width: '100%' }}>
          No stats available for this token.
        </Alert>
      </Snackbar>

      <Snackbar open={savedToast} autoHideDuration={2000} onClose={() => setSavedToast(false)}>
        <Alert severity="success" onClose={() => setSavedToast(false)} sx={{ width: '100%' }}>
          Encounter saved.
        </Alert>
      </Snackbar>

      {quickInputPopover?.kind === 'damage' && (
        <MapNumberInputPopover
          open
          anchorPosition={QUICK_POPOVER_ANCHOR()}
          title="Apply Damage"
          targetCount={quickInputPopover.targetIds.length}
          onSubmit={(amount) => applyBulkHp(quickInputPopover.targetIds, 'damage', amount)}
          onClose={() => setQuickInputPopover(null)}
        />
      )}
      {quickInputPopover?.kind === 'heal' && (
        <MapNumberInputPopover
          open
          anchorPosition={QUICK_POPOVER_ANCHOR()}
          title="Apply Healing"
          targetCount={quickInputPopover.targetIds.length}
          onSubmit={(amount) => applyBulkHp(quickInputPopover.targetIds, 'heal', amount)}
          onClose={() => setQuickInputPopover(null)}
        />
      )}
      {quickInputPopover?.kind === 'tempHp' && (
        <MapNumberInputPopover
          open
          anchorPosition={QUICK_POPOVER_ANCHOR()}
          title="Apply Temporary HP"
          targetCount={quickInputPopover.targetIds.length}
          onSubmit={(amount) => applyBulkHp(quickInputPopover.targetIds, 'tempHp', amount)}
          onClose={() => setQuickInputPopover(null)}
        />
      )}
      {quickInputPopover?.kind === 'tag' && (
        <MapTextInputPopover
          open
          anchorPosition={QUICK_POPOVER_ANCHOR()}
          title={`Add Tag${quickInputPopover.targetIds.length > 1 ? ` (${quickInputPopover.targetIds.length} combatants)` : ''}`}
          initialValue=""
          onSubmit={(value) => handleAddTag(quickInputPopover.targetIds, value)}
          onClose={() => setQuickInputPopover(null)}
        />
      )}
      {quickInputPopover?.kind === 'rename' && (
        <MapTextInputPopover
          open
          anchorPosition={QUICK_POPOVER_ANCHOR()}
          title="Rename"
          initialValue={quickInputPopover.initialValue}
          onSubmit={(value) => handleUpdateFloorToken(quickInputPopover.targetId, { name: value })}
          onClose={() => setQuickInputPopover(null)}
        />
      )}
      {quickInputPopover?.kind === 'notes' && (
        <MapTextInputPopover
          open
          anchorPosition={QUICK_POPOVER_ANCHOR()}
          title="Update Persistent Notes"
          initialValue={quickInputPopover.initialValue}
          multiline
          onSubmit={(value) => handleUpdateFloorToken(quickInputPopover.targetId, { notes: value })}
          onClose={() => setQuickInputPopover(null)}
        />
      )}

      <ShortcutsSettingsDialog open={shortcutsDialogOpen} onClose={() => setShortcutsDialogOpen(false)} />
    </AppShell>
  );
}

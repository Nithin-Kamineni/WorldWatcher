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
import { useCampaignStore, getCampaignById, getMapsForCampaign } from '../store/useCampaignStore';
import { useTokenLibraryStore } from '../store/useTokenLibraryStore';
import { useTokenManagerUiStore } from '../store/useTokenManagerUiStore';
import { useEncounterStore, getEncountersForCampaign } from '../store/useEncounterStore';
import { useCreatureStore, getCreaturesForCampaign } from '../store/useCreatureStore';
import { apiMapShapeToAoEShape, apiMapTokenToPlacedToken } from '../api/adapters';
import { connectRoom, floorRoom } from '../api/ws';
import type { ApiMapShape, ApiMapToken } from '../api/types';
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

const ZOOM_STEP = 1.2;
const MIN_SCALE = 0.2;
const MAX_SCALE = 5;

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

  const stageRef = useRef<Konva.Stage>(null);
  const keyHandlersRef = useRef<{ undo: () => void; redo: () => void }>({ undo: () => {}, redo: () => {} });

  const campaign = getCampaignById(campaigns, campaignId);
  const maps = getMapsForCampaign(mapsByCampaignId, campaignId);
  const map = maps.find((m) => m.id === mapId);
  const mapsLoaded = campaignId ? !!mapsLoadedByCampaignId[campaignId] : false;
  const activeFloor = map
    ? (map.floors.find((f) => f.id === activeFloorId) ?? getPrimaryFloor(map) ?? map.floors[0])
    : undefined;
  // Shares use-image's internal cache with MapBackgroundLayer's own useImage(src) call for
  // the same URL, so this doesn't trigger a second fetch - just gives Reset View access to
  // the image's natural (unscaled) dimensions to compute the best-fit rotation.
  const [backgroundImage] = useImage(activeFloor?.imageSrc ?? '');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveTool('select');
        return;
      }
      const ctrlOrCmd = e.ctrlKey || e.metaKey;
      if (ctrlOrCmd && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        keyHandlersRef.current.undo();
      } else if (ctrlOrCmd && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        keyHandlersRef.current.redo();
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
        default:
          break;
      }
    });
    return unsubscribe;
  }, [campaignId, map?.id, activeFloor?.id, applyRemoteFloorPatch]);

  if (!campaignId) {
    return <Navigate to="/campaigns" replace />;
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
    return <Navigate to={campaign ? `/campaigns/${campaign.id}/dm` : '/campaigns'} replace />;
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

  keyHandlersRef.current = { undo: handleUndo, redo: handleRedo };

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

  const handleUpdateFloorToken = (
    tokenId: string,
    changes: Partial<
      Pick<PlacedToken, 'name' | 'size' | 'outlineColor' | 'effects' | 'hp' | 'concentrating' | 'deathSaves' | 'notes'>
    >,
  ) => {
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.map((t) => (t.id === tokenId ? { ...t, ...changes } : t)),
    }));
  };

  const handleDeleteFloorToken = (tokenId: string) => {
    mutateActiveFloorWithHistory((floor) => ({
      ...floor!,
      placedTokens: floor!.placedTokens.filter((t) => t.id !== tokenId),
    }));
  };

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

  const handleTokenStatsRequest = (token: PlacedToken) => {
    const creatures = getCreaturesForCampaign(creaturesByCampaignId, campaignId);
    const encounters = getEncountersForCampaign(encountersByCampaignId, campaignId);
    const creature = findLinkedCreature(token, creatures, encounters);
    if (creature) {
      setStatsCreature(creature);
    } else {
      setNoStatsWarning(true);
    }
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
    };
  });

  return (
    <AppShell fullHeight disableGutters hideHeader={isFullscreen}>
      {!isFullscreen && (
        <Box sx={{ px: { xs: 2, sm: 3 }, pt: 3 }}>
          <Breadcrumbs
            items={[
              { label: 'Campaigns', to: '/campaigns' },
              { label: campaign.name, to: `/campaigns/${campaign.id}` },
              { label: 'Dungeon Master', to: `/campaigns/${campaign.id}/dm` },
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
          placedTokens={activeFloor?.placedTokens ?? []}
          initiative={activeFloor?.initiative ?? DEFAULT_INITIATIVE_STATE}
          onRollInitiative={handleRollInitiative}
          onCancelRoll={handleCancelRoll}
          onUpdateBaseRoll={handleUpdateBaseRoll}
          onToggleEntryLock={handleToggleEntryLock}
          onStartEncounter={handleStartEncounter}
          onNextTurn={handleNextTurn}
          onEndEncounter={handleEndEncounter}
          onUpdateToken={handleUpdateFloorToken}
        />
      </Stack>

      <Tooltip title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen map'}>
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
    </AppShell>
  );
}

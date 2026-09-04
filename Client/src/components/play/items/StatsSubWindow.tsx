import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import PetsIcon from '@mui/icons-material/Pets';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import DiamondIcon from '@mui/icons-material/Diamond';
import { ItemsSearchFilterBar } from './ItemsSearchFilterBar';
import { PinnableItemRow } from './PinnableItemRow';
import { NpcBuilderLauncher } from './BuilderLaunchers';
import { useCreatureStore, type CreatureScope } from '../../../store/useCreatureStore';
import { useSpellStore } from '../../../store/useSpellStore';
import { useMagicItemStore } from '../../../store/useMagicItemStore';
import { usePlayItemsStore, getPlayItemsState, getSlotItems, compositeId, splitComposite } from '../../../store/usePlayItemsStore';
import type { PaneSlot } from '../layout/playLayoutTrees';
import { formatSpellLevel, SPELL_SCHOOL_COLORS, schoolTextColor } from '../../../types/spell';
import { getMagicItemRarityOption } from '../../../types/magicItem';
import { CreatureExpandedDetails } from '../../dm/CreatureExpandedDetails';
import { thinScrollbarSx, FLOATING_SCROLLBAR_CLASS } from '../../../theme/scrollbarSx';

interface StatsSubWindowProps {
  worldId: string;
  campaignId: string;
  /** Which Items window this is - all pin/open/expand state below is scoped to it. */
  slot: PaneSlot;
}

type StatToggle = 'all' | 'npc' | 'creature' | 'spell' | 'item';
const SCOPE: CreatureScope = 'own_or_global';

/** Stats sub-window (issues.txt 10.c.5) - an All/Creature/Spell/Magic-Item toggle above the
 * shared search bar, browsing all 3 entity stores' server-side "browse" endpoints, on the
 * shared pin/collapse shell. */
export function StatsSubWindow({ worldId, campaignId, slot }: StatsSubWindowProps) {
  const [toggle, setToggle] = useState<StatToggle>('all');
  const [search, setSearch] = useState('');

  const creatureBrowse = useCreatureStore((s) => s.creatureBrowse);
  const fetchCreatureBrowse = useCreatureStore((s) => s.fetchCreatureBrowse);
  const spellBrowse = useSpellStore((s) => s.spellBrowse);
  const fetchSpellBrowse = useSpellStore((s) => s.fetchSpellBrowse);
  const magicItemBrowse = useMagicItemStore((s) => s.magicItemBrowse);
  const fetchMagicItemBrowse = useMagicItemStore((s) => s.fetchMagicItemBrowse);

  // Pinned/opened rows are resolved by id through these caches rather than out of the current
  // browse page. Without them an @-mention click from the session (or a pin from an earlier
  // search) rendered nothing at all, because the browse page only holds the 25 rows matching
  // whatever is typed in the search box right now - and is empty until something is typed.
  const creaturesById = useCreatureStore((s) => s.creaturesById);
  const fetchCreatureById = useCreatureStore((s) => s.fetchCreatureById);
  const spellsById = useSpellStore((s) => s.spellsById);
  const fetchSpellById = useSpellStore((s) => s.fetchSpellById);
  const magicItemsById = useMagicItemStore((s) => s.magicItemsById);
  const fetchMagicItemById = useMagicItemStore((s) => s.fetchMagicItemById);

  const hasQuery = search.trim() !== '';

  useEffect(() => {
    if (!hasQuery) return;
    if (toggle === 'all' || toggle === 'npc' || toggle === 'creature') {
      fetchCreatureBrowse({
        campaignId,
        scope: SCOPE,
        page: 1,
        pageSize: 25,
        search: search || undefined,
        category: toggle === 'npc' ? 'npc' : toggle === 'creature' ? 'monster' : undefined,
      });
    }
    if (toggle === 'all' || toggle === 'spell') {
      fetchSpellBrowse({ campaignId, scope: SCOPE, page: 1, pageSize: 25, search: search || undefined });
    }
    if (toggle === 'all' || toggle === 'item') {
      fetchMagicItemBrowse({ campaignId, scope: SCOPE, page: 1, pageSize: 25, search: search || undefined });
    }
    // fetch* actions are stable zustand references - omitted to avoid re-running on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasQuery, toggle, search, campaignId]);

  const byCampaignId = usePlayItemsStore((s) => s.byCampaignId);
  const focusItem = usePlayItemsStore((s) => s.focusItem);
  const pinItem = usePlayItemsStore((s) => s.pinItem);
  const unpinItem = usePlayItemsStore((s) => s.unpinItem);
  const toggleExpanded = usePlayItemsStore((s) => s.toggleExpanded);
  const slotState = getSlotItems(getPlayItemsState(byCampaignId, campaignId), slot);
  const pinned = slotState.pinnedByKind.stats;
  const current = slotState.currentByKind.stats;
  const expanded = slotState.expandedByKind.stats;

  const creatures = creatureBrowse?.items ?? [];
  const spells = spellBrowse?.items ?? [];
  const items = magicItemBrowse?.items ?? [];

  const browseRows = useMemo(() => {
    if (!hasQuery) return [];
    const rows: { compId: string; title: string; tagline: string; kind: 'creature' | 'spell' | 'item' }[] = [];
    if (toggle === 'all' || toggle === 'npc' || toggle === 'creature') {
      creatures.forEach((c) => rows.push({ compId: compositeId('creature', c.id), title: c.name, tagline: `${c.cr ? `CR ${c.cr}` : c.category} · ${c.type || c.category}`, kind: 'creature' }));
    }
    if (toggle === 'all' || toggle === 'spell') {
      spells.forEach((s) => rows.push({ compId: compositeId('spell', s.id), title: s.name, tagline: `${formatSpellLevel(s.level)} · ${s.school}`, kind: 'spell' }));
    }
    if (toggle === 'all' || toggle === 'item') {
      items.forEach((i) => rows.push({ compId: compositeId('item', i.id), title: i.name, tagline: `${getMagicItemRarityOption(i.rarity).label} · ${i.type}`, kind: 'item' }));
    }
    return rows.sort((a, b) => a.title.localeCompare(b.title));
  }, [hasQuery, toggle, creatures, spells, items]);

  const displayIds = [...pinned, ...(current && !pinned.includes(current) ? [current] : [])];

  useEffect(() => {
    displayIds.forEach((compId) => {
      const { kind, id } = splitComposite(compId);
      if (kind === 'creature' && !creaturesById[id]) void fetchCreatureById(id);
      if (kind === 'spell' && !spellsById[id]) void fetchSpellById(id);
      if (kind === 'item' && !magicItemsById[id]) void fetchMagicItemById(id);
    });
    // displayIds is derived and gets a new identity every render - depend on its stable string
    // form so this does not re-run the resolution loop constantly. The fetch* actions are
    // stable zustand references and each one no-ops on an already-cached id.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayIds.join(','), creaturesById, spellsById, magicItemsById]);

  // The browse page is preferred (it is the freshest copy of a row the DM is looking at) with
  // the by-id cache behind it, so an opened entity always resolves to something.
  const findCreature = (id: string) => creatures.find((x) => x.id === id) ?? creaturesById[id];
  const findSpell = (id: string) => spells.find((x) => x.id === id) ?? spellsById[id];
  const findMagicItem = (id: string) => items.find((x) => x.id === id) ?? magicItemsById[id];

  // Opening an entity puts its row at the top of this pane, which is off-screen if the DM was
  // scrolled down the browse list - scroll back up so the click visibly lands.
  const scrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (current) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [current]);

  const iconFor = (kind: 'creature' | 'spell' | 'item') =>
    kind === 'creature' ? <PetsIcon fontSize="small" color="action" /> : kind === 'spell' ? <AutoFixHighIcon fontSize="small" color="action" /> : <DiamondIcon fontSize="small" color="action" />;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <ItemsSearchFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search creatures, spells, items…"
        groups={[]}
        selected={{}}
        onToggle={() => {}}
        onClear={() => {}}
        extra={
          <ToggleButtonGroup size="small" exclusive value={toggle} onChange={(_e, v: StatToggle | null) => v && setToggle(v)} fullWidth>
            <ToggleButton value="all">All</ToggleButton>
            <ToggleButton value="npc">NPC</ToggleButton>
            <ToggleButton value="creature">Creature</ToggleButton>
            <ToggleButton value="spell">Spell</ToggleButton>
            <ToggleButton value="item">Item</ToggleButton>
          </ToggleButtonGroup>
        }
      />

      <Box ref={scrollRef} className={FLOATING_SCROLLBAR_CLASS} sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0, px: 1.25, pb: 1, ...thinScrollbarSx }}>
        {displayIds.length > 0 && (
          <Stack spacing={0} sx={{ mb: 1.5 }}>
            {displayIds.map((compId) => {
              const { kind, id } = splitComposite(compId);
              const isExpanded = expanded.includes(compId);
              const isPinned = pinned.includes(compId);
              if (kind === 'creature') {
                const c = findCreature(id);
                if (!c) return null;
                return (
                  <PinnableItemRow
                    key={compId}
                    icon={iconFor('creature')}
                    title={c.name}
                    tagline={`${c.cr ? `CR ${c.cr}` : ''} · AC ${c.ac} · HP ${c.hp}`}
                    pinned={isPinned}
                    onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'stats', compId) : pinItem(campaignId, slot, 'stats', compId))}
                    expanded={isExpanded}
                    onToggleExpand={() => toggleExpanded(campaignId, slot, 'stats', compId)}
                    onOpenNewTab={() => window.open(`/w/${worldId}/compendium?creature=${c.id}`, '_blank')}
                  >
                    <CreatureExpandedDetails creature={c} />
                  </PinnableItemRow>
                );
              }
              if (kind === 'spell') {
                const s = findSpell(id);
                if (!s) return null;
                const color = SPELL_SCHOOL_COLORS[s.school] ?? '#888';
                return (
                  <PinnableItemRow
                    key={compId}
                    icon={<AutoFixHighIcon fontSize="small" sx={{ color }} />}
                    title={s.name}
                    tagline={`${formatSpellLevel(s.level)} · ${s.school} · ${s.castingTime}`}
                    pinned={isPinned}
                    onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'stats', compId) : pinItem(campaignId, slot, 'stats', compId))}
                    expanded={isExpanded}
                    onToggleExpand={() => toggleExpanded(campaignId, slot, 'stats', compId)}
                    onOpenNewTab={() => window.open(`/w/${worldId}/compendium?spell=${s.id}`, '_blank')}
                  >
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ '& span': { bgcolor: color, color: schoolTextColor(color), px: 0.5, borderRadius: 0.5 } }}>
                      Range {s.range} · {s.components} · {s.duration}
                      <br />
                      {s.description?.slice(0, 160)}
                      {s.description && s.description.length > 160 ? '…' : ''}
                    </Typography>
                  </PinnableItemRow>
                );
              }
              const i = findMagicItem(id);
              if (!i) return null;
              return (
                <PinnableItemRow
                  key={compId}
                  icon={<DiamondIcon fontSize="small" color="action" />}
                  title={i.name}
                  tagline={`${getMagicItemRarityOption(i.rarity).label} · ${i.type}${i.attunement ? ' · Attunement' : ''}`}
                  pinned={isPinned}
                  onTogglePin={() => (isPinned ? unpinItem(campaignId, slot, 'stats', compId) : pinItem(campaignId, slot, 'stats', compId))}
                  expanded={isExpanded}
                  onToggleExpand={() => toggleExpanded(campaignId, slot, 'stats', compId)}
                  onOpenNewTab={() => window.open(`/w/${worldId}/compendium?item=${i.id}`, '_blank')}
                >
                  <Typography variant="caption" color="text.secondary">
                    {i.description?.slice(0, 160)}
                    {i.description && i.description.length > 160 ? '…' : ''}
                  </Typography>
                </PinnableItemRow>
              );
            })}
          </Stack>
        )}

        {toggle === 'npc' && <NpcBuilderLauncher worldId={worldId} campaignId={campaignId} />}

        <Typography variant="overline" color="text.secondary" sx={{ pl: 0.5 }}>
          Browse
        </Typography>
        {!hasQuery ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            Search to browse creatures, spells, and items.
          </Typography>
        ) : browseRows.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
            No matches.
          </Typography>
        ) : (
          <List dense disablePadding>
            {browseRows.map((row) => (
              <ListItemButton key={row.compId} onClick={() => focusItem(campaignId, slot, 'stats', row.compId)} sx={{ borderRadius: 1.5 }}>
                {iconFor(row.kind)}
                <ListItemText
                  primary={row.title}
                  secondary={row.tagline}
                  sx={{ ml: 1 }}
                  slotProps={{ primary: { sx: { fontSize: 13.5 } }, secondary: { sx: { fontSize: 11.5 } } }}
                />
              </ListItemButton>
            ))}
          </List>
        )}
      </Box>
    </Box>
  );
}

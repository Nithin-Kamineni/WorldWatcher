import { useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import type { SxProps, Theme } from '@mui/material/styles';
import { bbcodeToHtml, type EntityRefType } from '../../utils/bbcode';
import { TipTapArticleEditor } from '../world/richtext/TipTapArticleEditor';
import { isLikelyHtml } from '../world/richtext/bbcodeMigration';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useSpellStore, getSpellsForCampaign } from '../../store/useSpellStore';
import { useEncounterStore, getEncountersForCampaign } from '../../store/useEncounterStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import { useArticleStore, getArticleById } from '../../store/useArticleStore';
import { usePlayLayoutStore, getPlayLayoutState } from '../../store/usePlayLayoutStore';
import { usePlayItemsStore, mapEntityRefToItemsTarget } from '../../store/usePlayItemsStore';
import { getLayoutSlots } from '../../store/usePlayLayoutStore';
import { CreatureStatBlockDialog } from '../dm/CreatureStatBlockDialog';
import { SpellDetailDialog } from '../dm/SpellDetailDialog';
import { FactionPreviewCard } from './FactionPreviewCard';
import { EncounterPreviewCard } from './EncounterPreviewCard';

/** Delay before a single click's action fires, giving a following click a chance to arrive and
 * be reinterpreted as a double-click instead (see handleClick/handleDoubleClick below). */
const CLICK_DELAY_MS = 250;

interface EntityRefPreviewProps {
  body: string;
  worldId: string;
  campaignId: string;
  noteName: string;
  sx?: SxProps<Theme>;
  /** Situational table mentions have no preview surface in this component - only a
   * not-yet-built Play page panel knows how to open one, so this is a no-op unless that
   * caller passes a handler. */
  onOpenSituationalTable?: (id: string) => void;
  /** Play-page-only behavior: single-click opens/focuses the mention in the Items window
   * instead of the usual dialog/navigate, double-click still does the usual thing. Only
   * ChatPanel/SessionNotesPanel (both exclusively rendered inside the Play workspace) pass
   * this - every other renderer of notes keeps today's single-click behavior. */
  enableItemsWindowFocus?: boolean;
  /** Makes the body's checklist boxes tickable from this READING view and saves the result -
   * the DM ticks off a session-prep item mid-session without switching to Write (checklist
   * I-N2). Omit it and the boxes render, but refuse the tick rather than showing one that
   * cannot be saved. Only reaches HTML bodies; legacy BBCode ones have no checklists. */
  onBodyChange?: (html: string) => void;
}

/** Renders a note's body and makes every @-mention inside it clickable, wiki-style:
 * NPC/Creature/Spell/Faction/Encounter mentions pop the same card dialogs used elsewhere in
 * the DM Panel; Place mentions navigate to the full Article page with a `returnTo` back-link
 * to this note (see ArticleDetailPage). Uses one delegated click/keydown handler on the
 * rendered-HTML container rather than per-mention React handlers, since the mentions are
 * injected via dangerouslySetInnerHTML and aren't real React elements.
 *
 * Two body formats reach this component. Legacy BBCode bodies are converted with
 * bbcodeToHtml and injected as HTML, exactly as before. Bodies saved by the rich text editor
 * are ALREADY HTML, and are rendered by TipTap's own read-only render (the same one
 * ArticleContentView uses) rather than injected - that keeps custom blocks (collapsible,
 * secret, button) working and avoids feeding stored markup to dangerouslySetInnerHTML. Either
 * way the mentions end up as the same `span.ww-ref`, so the click delegation below is shared. */
export function EntityRefPreview({ body, worldId, campaignId, noteName, sx, onOpenSituationalTable, enableItemsWindowFocus, onBodyChange }: EntityRefPreviewProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingClickRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const layoutByCampaignId = usePlayLayoutStore((s) => s.byCampaignId);
  const ensureItemsPane = usePlayLayoutStore((s) => s.ensureItemsPane);
  const focusItemInTab = usePlayItemsStore((s) => s.focusItemInTab);

  const creatures = getCreaturesForCampaign(useCreatureStore((s) => s.creaturesByCampaignId), campaignId);
  const spells = getSpellsForCampaign(useSpellStore((s) => s.spellsByCampaignId), campaignId);
  const encounters = getEncountersForCampaign(useEncounterStore((s) => s.encountersByCampaignId), campaignId);
  const factions = getFactionsForCampaign(useFactionStore((s) => s.factionsByCampaignId), campaignId);
  const articles = useArticleStore((s) => s.articles);

  const [openCreatureId, setOpenCreatureId] = useState<string | null>(null);
  const [openSpellId, setOpenSpellId] = useState<string | null>(null);
  const [openFactionId, setOpenFactionId] = useState<string | null>(null);
  const [openEncounterId, setOpenEncounterId] = useState<string | null>(null);

  const goToArticle = (articleId: string) => {
    const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
    const fromLabel = encodeURIComponent(noteName);
    navigate(`/w/${worldId}/manager/entry/${articleId}?from=note&fromLabel=${fromLabel}&returnTo=${returnTo}`);
  };

  const openRef = (type: EntityRefType, id: string) => {
    switch (type) {
      case 'npc':
      case 'creature':
        setOpenCreatureId(id);
        break;
      case 'spell':
        setOpenSpellId(id);
        break;
      case 'faction':
        setOpenFactionId(id);
        break;
      case 'encounter':
        setOpenEncounterId(id);
        break;
      case 'place': {
        const article = getArticleById(articles, id);
        if (article) goToArticle(article.id);
        break;
      }
      case 'map':
        // Straight to the map page with this map open. A map is a whole screen, not something
        // that fits in a preview dialog - which is exactly why Play does not host one (P5).
        navigate(`/w/${worldId}/c/${campaignId}/maps/${id}`);
        break;
      case 'situational_table':
        onOpenSituationalTable?.(id);
        break;
    }
  };

  const focusInItemsWindow = (type: EntityRefType, id: string) => {
    const target = mapEntityRefToItemsTarget(type, id);
    if (!target) {
      openRef(type, id);
      return;
    }
    const layoutState = getPlayLayoutState(layoutByCampaignId, campaignId);
    const slots = getLayoutSlots(layoutState, layoutState.layoutId);
    const slot = ensureItemsPane(campaignId, layoutState.layoutId, slots);
    focusItemInTab(campaignId, slot, target.kind, target.itemId);
  };

  const refElementFromEvent = (e: React.SyntheticEvent): HTMLElement | null =>
    (e.target as HTMLElement).closest('[data-ref-type]') as HTMLElement | null;

  const clearPendingClick = () => {
    if (pendingClickRef.current !== null) {
      clearTimeout(pendingClickRef.current);
      pendingClickRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const el = refElementFromEvent(e);
    if (!el?.dataset.refId) return;
    const type = el.dataset.refType as EntityRefType;
    const id = el.dataset.refId;
    if (!enableItemsWindowFocus) {
      openRef(type, id);
      return;
    }
    // Defer the single-click action so a following click within the window can cancel it and
    // run the double-click action instead (see handleDoubleClick).
    clearPendingClick();
    pendingClickRef.current = setTimeout(() => {
      pendingClickRef.current = null;
      focusInItemsWindow(type, id);
    }, CLICK_DELAY_MS);
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    if (!enableItemsWindowFocus) return;
    const el = refElementFromEvent(e);
    if (!el?.dataset.refId) return;
    clearPendingClick();
    openRef(el.dataset.refType as EntityRefType, el.dataset.refId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = refElementFromEvent(e);
    if (!el?.dataset.refId) return;
    e.preventDefault();
    openRef(el.dataset.refType as EntityRefType, el.dataset.refId);
  };

  // Either children (rich text render) or dangerouslySetInnerHTML (legacy BBCode) - never
  // both, which React rejects outright.
  const bodyProps = isLikelyHtml(body)
    ? { children: <TipTapArticleEditor value={body} editable={false} onChange={onBodyChange} /> }
    : { dangerouslySetInnerHTML: { __html: bbcodeToHtml(body) } };

  const openCreature = openCreatureId ? (creatures.find((c) => c.id === openCreatureId) ?? null) : null;
  const openSpell = openSpellId ? (spells.find((s) => s.id === openSpellId) ?? null) : null;
  const openFaction = openFactionId ? (factions.find((f) => f.id === openFactionId) ?? null) : null;
  const openEncounter = openEncounterId ? (encounters.find((e) => e.id === openEncounterId) ?? null) : null;

  return (
    <>
      <Box
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
        onKeyDown={handleKeyDown}
        sx={{
          '& .ww-ref': {
            cursor: 'pointer',
            color: 'primary.main',
            fontWeight: 600,
            borderBottom: '1px dashed',
            borderColor: 'primary.main',
            '&:hover': { color: 'primary.dark' },
          },
          ...sx,
        }}
        {...bodyProps}
      />

      <CreatureStatBlockDialog
        open={openCreature !== null}
        creature={openCreature}
        onClose={() => setOpenCreatureId(null)}
        worldId={worldId}
        onViewArticle={(_creature, articleId) => goToArticle(articleId)}
      />
      <SpellDetailDialog open={openSpell !== null} spell={openSpell} onClose={() => setOpenSpellId(null)} />
      <FactionPreviewCard open={openFaction !== null} faction={openFaction} onClose={() => setOpenFactionId(null)} />
      <EncounterPreviewCard open={openEncounter !== null} encounter={openEncounter} onClose={() => setOpenEncounterId(null)} />
    </>
  );
}

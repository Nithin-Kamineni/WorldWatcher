import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Dialog from '@mui/material/Dialog';
import InputBase from '@mui/material/InputBase';
import Box from '@mui/material/Box';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import { useShellStore } from '../../store/useShellStore';
import { useWorldStore, getCampaignsForWorld } from '../../store/useWorldStore';
import { useCampaignStore } from '../../store/useCampaignStore';
import { useFactionStore, getFactionsForCampaign } from '../../store/useFactionStore';
import { useQuestStore } from '../../store/useQuestStore';
import { useCreatureStore, getCreaturesForCampaign } from '../../store/useCreatureStore';
import { useEncounterStore, getEncountersForCampaign } from '../../store/useEncounterStore';

interface PaletteEntry {
  id: string;
  group: 'Go to' | 'Jump to' | 'Actions';
  label: string;
  sublabel?: string;
  onSelect: () => void;
}

interface CommandPaletteProps {
  worldId?: string;
  campaignId?: string;
}

export function CommandPalette({ worldId, campaignId }: CommandPaletteProps) {
  const navigate = useNavigate();
  const open = useShellStore((s) => s.paletteOpen);
  const setOpen = useShellStore((s) => s.setPaletteOpen);
  const setNewWorldOpen = useShellStore((s) => s.setNewWorldDialogOpen);
  const setNewCampaignOpen = useShellStore((s) => s.setNewCampaignDialogOpen);

  const worlds = useWorldStore((s) => s.worlds);
  const fetchWorlds = useWorldStore((s) => s.fetchWorlds);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const fetchCampaigns = useCampaignStore((s) => s.fetchCampaigns);

  const factionsByCampaignId = useFactionStore((s) => s.factionsByCampaignId);
  const fetchFactionsForCampaign = useFactionStore((s) => s.fetchFactionsForCampaign);
  const questsByCampaignId = useQuestStore((s) => s.questsByCampaignId);
  const fetchQuestsForCampaign = useQuestStore((s) => s.fetchQuestsForCampaign);
  const creaturesByCampaignId = useCreatureStore((s) => s.creaturesByCampaignId);
  const fetchCreaturesForCampaign = useCreatureStore((s) => s.fetchCreaturesForCampaign);
  const encountersByCampaignId = useEncounterStore((s) => s.encountersByCampaignId);
  const fetchEncountersForCampaign = useEncounterStore((s) => s.fetchEncountersForCampaign);
  const mapsByCampaignId = useCampaignStore((s) => s.mapsByCampaignId);
  const fetchMapsForCampaign = useCampaignStore((s) => s.fetchMapsForCampaign);

  const [query, setQuery] = useState('');

  // Global Ctrl/Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    fetchWorlds();
    fetchCampaigns();
    if (campaignId) {
      fetchFactionsForCampaign(campaignId);
      fetchQuestsForCampaign(campaignId);
      fetchCreaturesForCampaign(campaignId);
      fetchEncountersForCampaign(campaignId);
      fetchMapsForCampaign(campaignId);
    }
  }, [
    open,
    campaignId,
    fetchWorlds,
    fetchCampaigns,
    fetchFactionsForCampaign,
    fetchQuestsForCampaign,
    fetchCreaturesForCampaign,
    fetchEncountersForCampaign,
    fetchMapsForCampaign,
  ]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  const go = (path: string) => {
    close();
    navigate(path);
  };

  const entries = useMemo<PaletteEntry[]>(() => {
    const list: PaletteEntry[] = [];

    // ---- Go to: static sitemap entries ----
    list.push({ id: 'go-dashboard', group: 'Go to', label: 'Dashboard', onSelect: () => go('/dashboard') });

    if (worldId) {
      list.push({ id: 'go-home', group: 'Go to', label: 'World Home', onSelect: () => go(`/w/${worldId}/home`) });
      list.push({ id: 'go-manager', group: 'Go to', label: 'World Manager', onSelect: () => go(`/w/${worldId}/manager`) });
      list.push({ id: 'go-atlas', group: 'Go to', label: 'Atlas', sublabel: 'Coming soon', onSelect: () => go(`/w/${worldId}/atlas`) });
      list.push({ id: 'go-timeline', group: 'Go to', label: 'Timeline', sublabel: 'Coming soon', onSelect: () => go(`/w/${worldId}/timeline`) });
      list.push({ id: 'go-compendium', group: 'Go to', label: 'Compendium', onSelect: () => go(`/w/${worldId}/compendium`) });
      list.push({ id: 'go-tools', group: 'Go to', label: 'Tools', sublabel: 'Coming soon', onSelect: () => go(`/w/${worldId}/tools`) });
      list.push({ id: 'go-world-settings', group: 'Go to', label: 'World settings', sublabel: 'Coming soon', onSelect: () => go(`/w/${worldId}/settings`) });
    }

    if (worldId && campaignId) {
      list.push({ id: 'go-campaign-home', group: 'Go to', label: 'Campaign Home', onSelect: () => go(`/w/${worldId}/c/${campaignId}/home`) });
      list.push({ id: 'go-play', group: 'Go to', label: 'Play', sublabel: 'Coming soon', onSelect: () => go(`/w/${worldId}/c/${campaignId}/play`) });
      list.push({ id: 'go-notes-folders', group: 'Go to', label: 'Notes - Folders', onSelect: () => go(`/w/${worldId}/c/${campaignId}/notes?tab=folders`) });
      list.push({ id: 'go-notes-plots', group: 'Go to', label: 'Notes - Plots', sublabel: 'Coming soon', onSelect: () => go(`/w/${worldId}/c/${campaignId}/notes?tab=plots`) });
      list.push({ id: 'go-notes-quests', group: 'Go to', label: 'Notes - Quests', onSelect: () => go(`/w/${worldId}/c/${campaignId}/notes?tab=quests`) });
      list.push({ id: 'go-encounters', group: 'Go to', label: 'Encounters', onSelect: () => go(`/w/${worldId}/c/${campaignId}/encounters`) });
      list.push({ id: 'go-maps', group: 'Go to', label: 'Maps', onSelect: () => go(`/w/${worldId}/c/${campaignId}/maps`) });
      list.push({ id: 'go-characters', group: 'Go to', label: 'Characters', onSelect: () => go(`/w/${worldId}/manager?folder=characters`) });
      list.push({ id: 'go-bastions', group: 'Go to', label: 'Bastions', onSelect: () => go(`/w/${worldId}/manager?folder=places-bastions`) });
      list.push({
        id: 'go-campaign-settings',
        group: 'Go to',
        label: 'Campaign settings',
        sublabel: 'Coming soon',
        onSelect: () => go(`/w/${worldId}/c/${campaignId}/settings`),
      });
    }

    // ---- Jump to: live data ----
    worlds.forEach((w) =>
      list.push({ id: `world-${w.id}`, group: 'Jump to', label: w.name, sublabel: 'World', onSelect: () => go(`/w/${w.id}/home`) }),
    );
    if (worldId) {
      getCampaignsForWorld(campaigns, worldId).forEach((c) =>
        list.push({
          id: `campaign-${c.id}`,
          group: 'Jump to',
          label: c.name,
          sublabel: 'Campaign',
          onSelect: () => go(`/w/${worldId}/c/${c.id}/home`),
        }),
      );
    }
    if (worldId && campaignId) {
      getFactionsForCampaign(factionsByCampaignId, campaignId).forEach((f) =>
        list.push({
          id: `faction-${f.id}`,
          group: 'Jump to',
          label: f.name,
          sublabel: 'Faction',
          onSelect: () => go(`/w/${worldId}/manager?folder=factions`),
        }),
      );
      (questsByCampaignId[campaignId] ?? []).forEach((q) =>
        list.push({
          id: `quest-${q.id}`,
          group: 'Jump to',
          label: q.name,
          sublabel: 'Quest',
          onSelect: () => go(`/w/${worldId}/c/${campaignId}/notes?tab=quests`),
        }),
      );
      getCreaturesForCampaign(creaturesByCampaignId, campaignId)
        .filter((c) => c.category === 'npc')
        .forEach((c) =>
          list.push({
            id: `npc-${c.id}`,
            group: 'Jump to',
            label: c.name,
            sublabel: 'NPC',
            onSelect: () => go(`/w/${worldId}/manager?folder=npcs`),
          }),
        );
      getEncountersForCampaign(encountersByCampaignId, campaignId).forEach((e) =>
        list.push({
          id: `encounter-${e.id}`,
          group: 'Jump to',
          label: e.name,
          sublabel: 'Encounter',
          onSelect: () => go(`/w/${worldId}/c/${campaignId}/encounters`),
        }),
      );
      (mapsByCampaignId[campaignId] ?? []).forEach((m) =>
        list.push({
          id: `map-${m.id}`,
          group: 'Jump to',
          label: m.name,
          sublabel: 'Map',
          onSelect: () => go(`/w/${worldId}/c/${campaignId}/maps/${m.id}`),
        }),
      );
    }

    // ---- Actions ----
    list.push({ id: 'new-world', group: 'Actions', label: 'New world', onSelect: () => { close(); setNewWorldOpen(true); } });
    if (worldId) {
      list.push({ id: 'new-campaign', group: 'Actions', label: 'New campaign', onSelect: () => { close(); setNewCampaignOpen(true); } });
    }
    if (worldId && campaignId) {
      list.push({ id: 'new-session-prep', group: 'Actions', label: 'New session prep', onSelect: () => go(`/w/${worldId}/c/${campaignId}/notes?tab=folders&newSession=1`) });
      list.push({ id: 'new-quest', group: 'Actions', label: 'New quest', onSelect: () => go(`/w/${worldId}/c/${campaignId}/notes?tab=quests&new=1`) });
      list.push({ id: 'new-encounter', group: 'Actions', label: 'New encounter', onSelect: () => go(`/w/${worldId}/c/${campaignId}/encounters?new=1`) });
      list.push({ id: 'new-map', group: 'Actions', label: 'New map', onSelect: () => go(`/w/${worldId}/c/${campaignId}/maps?new=1`) });
      list.push({ id: 'new-bastion', group: 'Actions', label: 'New bastion', onSelect: () => go(`/w/${worldId}/manager?folder=places-bastions&new=1`) });
    }
    if (worldId) {
      list.push({ id: 'new-npc-faction', group: 'Actions', label: 'New NPC / faction', onSelect: () => go(`/w/${worldId}/manager?new=1`) });
    }

    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldId, campaignId, worlds, campaigns, factionsByCampaignId, questsByCampaignId, creaturesByCampaignId, encountersByCampaignId, mapsByCampaignId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((e) => e.label.toLowerCase().includes(q));
  }, [entries, query]);

  const groups: PaletteEntry['group'][] = ['Go to', 'Jump to', 'Actions'];

  return (
    <Dialog open={open} onClose={close} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <SearchIcon color="disabled" />
        <InputBase
          autoFocus
          fullWidth
          placeholder="Search or jump to anything…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Box>
      <Box sx={{ maxHeight: 420, overflowY: 'auto' }}>
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
            No matches.
          </Typography>
        )}
        {groups.map((group) => {
          const groupEntries = filtered.filter((e) => e.group === group);
          if (groupEntries.length === 0) return null;
          return (
            <List key={group} dense subheader={<ListSubheader disableSticky>{group}</ListSubheader>}>
              {groupEntries.slice(0, 20).map((entry) => (
                <ListItemButton key={entry.id} onClick={entry.onSelect}>
                  <ListItemText primary={entry.label} secondary={entry.sublabel} />
                </ListItemButton>
              ))}
            </List>
          );
        })}
      </Box>
    </Dialog>
  );
}

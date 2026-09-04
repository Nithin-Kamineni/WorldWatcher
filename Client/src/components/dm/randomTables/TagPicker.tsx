import { useEffect, useMemo, useState } from 'react';
import Autocomplete from '@mui/material/Autocomplete';
import TextField from '@mui/material/TextField';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { useTagStore } from '../../../store/useTagStore';
import type { Tag } from '../../../types/tag';

interface TagPickerProps {
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  label?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  /** Namespace new free-solo tags default into when the typed text has no "namespace:" prefix. */
  defaultNamespace?: string;
  /** Tag id -> how many items currently carry that tag. When given, each option shows the
   * count, tags nothing carries are hidden, and options sort by count first - which is what
   * makes this usable as a filter facet on a large library. Omit when editing a single
   * entity's tags, where the whole vocabulary must stay pickable. */
  counts?: Map<string, number>;
  countLabel?: string;
}

/** Multi-select tag picker grouped by namespace, backed by useTagStore's session-cached tag
 * list. Reused both as a filter facet (controlled selectedTagIds/onChange) and as the tag
 * editor on a single table/generator. Typing free text creates a new tag on the fly, parsed
 * as "namespace:value" (or falling back to defaultNamespace / "misc" with no ":"). */
export function TagPicker({ selectedTagIds, onChange, label = 'Tags', placeholder, size = 'small', defaultNamespace, counts, countLabel = 'table' }: TagPickerProps) {
  const tags = useTagStore((s) => s.tags);
  const fetchTags = useTagStore((s) => s.fetchTags);
  const createTag = useTagStore((s) => s.createTag);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchTags();
  }, [fetchTags]);

  const selectedTags = useMemo(
    () => selectedTagIds.map((id) => tags.find((t) => t.id === id)).filter((t): t is Tag => !!t),
    [selectedTagIds, tags],
  );

  const sortedTags = useMemo(() => {
    const pool = counts ? tags.filter((t) => (counts.get(t.id) ?? 0) > 0 || selectedTagIds.includes(t.id)) : tags;
    return [...pool].sort((a, b) => {
      if (a.namespace !== b.namespace) return a.namespace.localeCompare(b.namespace);
      if (counts) {
        const byCount = (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0);
        if (byCount !== 0) return byCount;
      }
      return a.label.localeCompare(b.label);
    });
  }, [tags, counts, selectedTagIds]);

  const resolveFreeSolo = async (raw: string): Promise<Tag | null> => {
    const trimmed = raw.trim();
    if (!trimmed) return null;
    const colonIndex = trimmed.indexOf(':');
    const namespace = colonIndex > 0 ? trimmed.slice(0, colonIndex).trim() : (defaultNamespace ?? 'misc');
    const rawValue = colonIndex > 0 ? trimmed.slice(colonIndex + 1) : trimmed;
    const value = rawValue.trim().toLowerCase().replace(/\s+/g, '-');
    if (!value) return null;
    const existing = tags.find((t) => t.namespace === namespace && t.value === value);
    if (existing) return existing;
    return createTag(namespace, value, trimmed);
  };

  return (
    <Autocomplete<Tag, true, false, true>
      multiple
      freeSolo
      disableCloseOnSelect
      size={size}
      options={sortedTags}
      value={selectedTags}
      loading={creating}
      groupBy={(option) => option.namespace}
      getOptionLabel={(option) => (typeof option === 'string' ? option : `${option.namespace}:${option.value}`)}
      isOptionEqualToValue={(option, value) => (typeof value === 'string' ? false : option.id === value.id)}
      onChange={(_e, value) => {
        void (async () => {
          const nextTags: Tag[] = [];
          setCreating(true);
          for (const item of value) {
            if (typeof item === 'string') {
              const resolved = await resolveFreeSolo(item);
              if (resolved) nextTags.push(resolved);
            } else {
              nextTags.push(item);
            }
          }
          setCreating(false);
          const seen = new Set<string>();
          const deduped = nextTags.filter((t) => (seen.has(t.id) ? false : (seen.add(t.id), true)));
          onChange(deduped.map((t) => t.id));
        })();
      }}
      renderValue={(value, getItemProps) =>
        value.map((tag, index) => {
          const chipLabel = typeof tag === 'string' ? tag : `${tag.namespace}:${tag.value}`;
          const key = typeof tag === 'string' ? `${tag}-${index}` : tag.id;
          return <Chip label={chipLabel} size="small" {...getItemProps({ index })} key={key} />;
        })
      }
      renderOption={(props, option) => {
        const count = counts?.get(option.id);
        return (
          <li {...props} key={option.id}>
            <Typography variant="body2" sx={{ mr: 1 }}>
              {option.label}
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ flexGrow: 1 }}>
              {option.namespace}:{option.value}
            </Typography>
            {count !== undefined && (
              <Chip
                size="small"
                variant="outlined"
                label={`${count} ${countLabel}${count === 1 ? '' : 's'}`}
                sx={{ height: 20, fontSize: 11, ml: 1, flexShrink: 0 }}
              />
            )}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder={placeholder ?? 'namespace:value, or search…'} />
      )}
    />
  );
}

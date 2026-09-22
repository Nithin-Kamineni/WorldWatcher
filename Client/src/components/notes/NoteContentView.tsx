import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { EntityRefPreview } from './EntityRefPreview';
import type { NoteKind } from '../../types/note';
import { PageTitle } from '../shell/PageTitle';

const KIND_LABEL: Record<NoteKind, string> = {
  session_prep: 'Session',
  narrative: 'Narrative',
};

interface NoteContentViewProps {
  worldId: string;
  campaignId: string;
  name: string;
  kind: NoteKind | null;
  tags: string[];
  body: string;
  /** Controls rendered next to the kind chip - the read page's "Edit" button. Omitted by the
   * editor's Preview tab, which already has its own toolbar. */
  headerActions?: ReactNode;
  /** Saves a checklist box ticked from this reading view. The saved-note render passes it; the
   * editor's Preview tab does not, since its draft is not saved yet (checklist I-N2). */
  onBodyChange?: (html: string) => void;
}

/** The reading view of a Note - the notes-side counterpart of ArticleContentView, and shared
 * the same way: NoteDetailPage renders it for a saved note, and the editor's Preview tab
 * renders it over the unsaved draft, so "Preview" and "what it looks like when I come back to
 * it" can never drift apart. Notes have no cover image or template fields, so this is the
 * article view minus the banner and the field grid: title, kind, tags, body. */
export function NoteContentView({ worldId, campaignId, name, kind, tags, body, headerActions, onBodyChange }: NoteContentViewProps) {
  return (
    <Box>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, mb: 1 }}>
        <PageTitle>{name || 'Untitled note'}</PageTitle>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          {kind && <Chip label={KIND_LABEL[kind]} size="small" variant="outlined" />}
          {headerActions}
        </Stack>
      </Stack>

      {tags.length > 0 && (
        <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, mb: 2 }}>
          {tags.map((tag) => (
            <Chip key={tag} label={tag} size="small" />
          ))}
        </Stack>
      )}

      {body.trim() ? (
        <EntityRefPreview
          body={body}
          worldId={worldId}
          campaignId={campaignId}
          noteName={name}
          onBodyChange={onBodyChange}
          sx={{ fontSize: 16, lineHeight: 1.75 }}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">
          This note is empty. Switch to Write to start it.
        </Typography>
      )}
    </Box>
  );
}

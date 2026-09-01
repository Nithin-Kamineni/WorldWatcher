import { useEffect } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { SectionLayout } from '../../components/shell/SectionLayout';
import { SessionRunnerSetupScreen } from '../../components/play/SessionRunnerSetupScreen';
import { SessionRunnerWorkspace } from '../../components/play/SessionRunnerWorkspace';
import { useNoteStore, getNotesForCampaign } from '../../store/useNoteStore';
import { usePlayUiStore, getPlayState } from '../../store/usePlayUiStore';

/** The session-runner screen - everything a DM needs on-screen while actually running a
 * session. First asks which session-prep document to run and (optionally) which DM notes chat
 * to use (SessionRunnerSetupScreen), then hands off to the fully layout-editable workspace
 * (SessionRunnerWorkspace) - see usePlayUiStore for the picked session and usePlayLayoutStore/
 * usePlayItemsStore for everything about the workspace's own arrangement. No breadcrumbs here
 * (issues.txt main-page point 1) - "back to setup"/layout controls live in TopBar while a
 * session is active (see TopBar.tsx). */
export function PlayPage() {
  const { worldId, campaignId } = useParams<{ worldId: string; campaignId: string }>();

  const notes = useNoteStore((s) => s.notes);
  const ensureNotesSeeded = useNoteStore((s) => s.ensureSeeded);
  const byCampaignId = usePlayUiStore((s) => s.byCampaignId);
  const startSession = usePlayUiStore((s) => s.startSession);

  useEffect(() => {
    if (campaignId) ensureNotesSeeded(campaignId);
  }, [campaignId, ensureNotesSeeded]);

  if (!worldId || !campaignId) return <Navigate to="/dashboard" replace />;

  const campaignNotes = getNotesForCampaign(notes, campaignId);
  const sessionNotes = campaignNotes.filter((n) => n.kind === 'session_prep').sort((a, b) => b.updatedAt - a.updatedAt);
  const switchableNotes = campaignNotes
    .filter((n) => n.kind === 'session_prep' || n.kind === 'narrative')
    .sort((a, b) => b.updatedAt - a.updatedAt);

  const playState = getPlayState(byCampaignId, campaignId);
  const sessionNote = sessionNotes.find((n) => n.id === playState.sessionNoteId);

  return (
    <SectionLayout worldId={worldId} campaignId={campaignId} disableContentPadding={!!sessionNote}>
      {sessionNote ? (
        <SessionRunnerWorkspace
          worldId={worldId}
          campaignId={campaignId}
          sessionNote={sessionNote}
          switchableNotes={switchableNotes}
          chatId={playState.chatId}
        />
      ) : (
        <SessionRunnerSetupScreen
          worldId={worldId}
          campaignId={campaignId}
          sessionNotes={sessionNotes}
          onComplete={(noteId, chatId) => startSession(campaignId, noteId, chatId)}
        />
      )}
    </SectionLayout>
  );
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNoteStore } from '../../../store/useNoteStore';
import type { NoteCanvas } from '../../../types/noteCanvas';

/** How long after the last edit the canvas is written back to the note. Short enough that a
 * closed tab loses nothing worth missing, long enough that dragging a sticky across the board
 * is one PATCH instead of sixty. */
const SAVE_DEBOUNCE_MS = 600;
const HISTORY_LIMIT = 50;

interface HistoryState<T> {
  doc: T;
  past: T[];
  future: T[];
}

export interface CanvasDoc<T extends NoteCanvas> {
  doc: T;
  /** A discrete edit - add, delete, recolour, drop a node somewhere. Becomes its own undo
   * step. */
  commit: (updater: (prev: T) => T) => void;
  /** A frame of a continuous edit - a drag in progress, a pan, a keystroke inside a sticky.
   * Saved like any other change but NOT its own undo step; call `beginHistory()` once as the
   * gesture starts so the whole gesture undoes together. */
  update: (updater: (prev: T) => T) => void;
  beginHistory: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** An edit is made but not yet written back - drives the "Saving…/Saved" caption. */
  pending: boolean;
}

/** State, history and persistence for one canvas note (whiteboard or content tree).
 *
 * The editor owns the document while it is open and pushes it back to useNoteStore on a
 * debounce; the store is optimistic, so the PATCH happens in the background exactly as it does
 * for a text note's body. Unlike the text editor there is no explicit Save button: on a canvas
 * the gesture IS the commit - dragging a sticky and then being asked to press Save would be a
 * worse lie than autosaving, and the map behaves the same way.
 *
 * It deliberately does NOT re-sync from the note prop. Mount the editor with `key={note.id}`
 * so switching documents remounts it; that keeps one writer for the document and avoids the
 * store's own optimistic echo fighting an in-flight drag. */
export function useCanvasDoc<T extends NoteCanvas>(noteId: string, initial: T): CanvasDoc<T> {
  const updateNote = useNoteStore((s) => s.updateNote);
  const [state, setState] = useState<HistoryState<T>>(() => ({ doc: initial, past: [], future: [] }));
  const [pending, setPending] = useState(false);

  // Mirrors `state` so several edits inside one event (say, delete a node and its links)
  // compose off the newest document instead of each reading the render-time snapshot.
  const stateRef = useRef(state);
  const timer = useRef<number | null>(null);
  const latest = useRef<T>(initial);
  const noteIdRef = useRef(noteId);
  noteIdRef.current = noteId;
  const updateNoteRef = useRef(updateNote);
  updateNoteRef.current = updateNote;

  const schedule = useCallback((next: T) => {
    latest.current = next;
    setPending(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      updateNoteRef.current(noteIdRef.current, { canvas: latest.current });
      setPending(false);
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Leaving the page mid-debounce still saves - navigating away from a board is the most
  // ordinary way to finish editing one.
  useEffect(
    () => () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      updateNoteRef.current(noteIdRef.current, { canvas: latest.current });
    },
    [],
  );

  const apply = useCallback(
    (next: HistoryState<T>) => {
      stateRef.current = next;
      setState(next);
      schedule(next.doc);
    },
    [schedule],
  );

  const commit = useCallback(
    (updater: (prev: T) => T) => {
      const cur = stateRef.current;
      const doc = updater(cur.doc);
      if (doc === cur.doc) return;
      apply({ doc, past: [...cur.past, cur.doc].slice(-HISTORY_LIMIT), future: [] });
    },
    [apply],
  );

  const update = useCallback(
    (updater: (prev: T) => T) => {
      const cur = stateRef.current;
      const doc = updater(cur.doc);
      if (doc === cur.doc) return;
      apply({ ...cur, doc });
    },
    [apply],
  );

  const beginHistory = useCallback(() => {
    const cur = stateRef.current;
    const next = { ...cur, past: [...cur.past, cur.doc].slice(-HISTORY_LIMIT), future: [] };
    stateRef.current = next;
    setState(next);
  }, []);

  const undo = useCallback(() => {
    const cur = stateRef.current;
    if (cur.past.length === 0) return;
    const doc = cur.past[cur.past.length - 1];
    apply({ doc, past: cur.past.slice(0, -1), future: [cur.doc, ...cur.future].slice(0, HISTORY_LIMIT) });
  }, [apply]);

  const redo = useCallback(() => {
    const cur = stateRef.current;
    if (cur.future.length === 0) return;
    const [doc, ...future] = cur.future;
    apply({ doc, past: [...cur.past, cur.doc].slice(-HISTORY_LIMIT), future });
  }, [apply]);

  return {
    doc: state.doc,
    commit,
    update,
    beginHistory,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
    pending,
  };
}

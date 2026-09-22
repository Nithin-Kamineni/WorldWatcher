import { useEffect, useRef, useState } from 'react';

/** A draft that was being edited when the editor went away, with when it was last touched. */
interface StoredDraft<T> {
  savedAt: number;
  draft: T;
}

/** Drafts older than this are ignored on load - a week-old "recover this?" bar is noise, not a
 * rescue, and the note it belongs to has almost certainly moved on. */
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function read<T>(key: string): StoredDraft<T> | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || typeof parsed.savedAt !== 'number' || Date.now() - parsed.savedAt > MAX_AGE_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

export interface UnsavedDraft<T> {
  /** A draft found on mount that the editor has not adopted, or null. */
  recovered: T | null;
  /** When it was last touched - for "from 3 minutes ago". */
  recoveredAt: number | null;
  /** Stop offering the recovered draft, and forget it. */
  discardRecovered: () => void;
  /** Forget the stored draft entirely - call on save and on an explicit cancel/revert. */
  clear: () => void;
}

/** Keeps an editor's in-progress edits recoverable, and warns before the tab is closed on top
 * of them.
 *
 * The note editor tracked `dirty` and said "Unsaved changes", but leaving by the breadcrumb or
 * the icon rail threw the draft away without a word (checklist I-N6). A router-level navigation
 * block is not available here - useBlocker needs a data router and the app runs a plain
 * BrowserRouter - so this closes the hole from the other side instead: the draft is mirrored to
 * localStorage while it is dirty, and offered back the next time the same editor opens. That is
 * strictly better than a confirm dialog anyway, since it also survives a crash, a closed tab and
 * a reload. `beforeunload` still covers the one case the browser will let us intercept.
 *
 * `enabled` is the editor's own dirty flag: nothing is written, and nothing is warned about,
 * while the draft matches what is saved. */
export function useUnsavedDraft<T>(key: string, value: T, enabled: boolean): UnsavedDraft<T> {
  const [recovered, setRecovered] = useState<StoredDraft<T> | null>(() => read<T>(key));

  // Re-read when the editor switches to a different note.
  const lastKey = useRef(key);
  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    setRecovered(read<T>(key));
  }, [key]);

  useEffect(() => {
    if (!enabled) return;
    try {
      localStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), draft: value } satisfies StoredDraft<T>));
    } catch {
      // A full or blocked localStorage must not break editing - the draft is a safety net.
    }
  }, [key, value, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Chrome ignores the string and shows its own wording; assigning it is still what arms
      // the prompt in some browsers.
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [enabled]);

  const forget = () => {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignored - see above
    }
  };

  return {
    recovered: recovered?.draft ?? null,
    recoveredAt: recovered?.savedAt ?? null,
    discardRecovered: () => {
      forget();
      setRecovered(null);
    },
    clear: () => {
      forget();
      setRecovered(null);
    },
  };
}

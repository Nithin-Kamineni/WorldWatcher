import { useEffect, useState } from 'react';

/**
 * Creates an object URL for a File and revokes it automatically when the
 * file changes or the component unmounts. Intended for short-lived local
 * previews (e.g. an object image being placed on the map) — URLs handed off
 * to the Zustand store (map backgrounds) are NOT managed by this hook, since
 * those must outlive the component that uploaded them for the rest of the session.
 */
export function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  return url;
}

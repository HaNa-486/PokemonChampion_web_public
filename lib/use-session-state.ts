"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/** Restore after hydration, then persist this tab's research context. */
export function useSessionState<T>(key: string, initial: T, validate?: (value: unknown) => boolean, restore?: (value: T) => T): [T, Dispatch<SetStateAction<T>>] {
  key = `champions-demo:${key}`;
  const [value, setValue] = useState(initial);
  const [restoredKey, setRestoredKey] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // Defer browser-only hydration until the server's initial tree has mounted.
    queueMicrotask(() => {
    if (cancelled) return;
    setValue(initial);
    try {
      const saved = sessionStorage.getItem(key);
      if (saved !== null) {
        const parsed: unknown = JSON.parse(saved);
        if (typeof parsed === typeof initial && Array.isArray(parsed) === Array.isArray(initial) && parsed !== null && (!validate || validate(parsed))) setValue(restore ? restore(parsed as T) : parsed as T);
      }
    } catch { /* Unavailable browser storage must not block research. */ }
    setRestoredKey(key);
    });
    return () => { cancelled = true; };
    // The initial value is a fallback, not a subscription.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  useEffect(() => {
    if (restoredKey === key) try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Session memory is optional. */ }
  }, [key, restoredKey, value]);
  return [value, setValue];
}

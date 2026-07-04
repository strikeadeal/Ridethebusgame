import { useEffect } from 'react';

/** Keep the screen awake during play. Best-effort: iOS Safari 16.4+ supports
 *  it; anywhere else this silently does nothing. */
export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        if (!('wakeLock' in navigator)) return;
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void sentinel.release();
        } else {
          lock = sentinel;
        }
      } catch {
        // Denied or unsupported — not worth surfacing at a party.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
    };
  }, [active]);
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { BUILD } from '../buildInfo.js';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const RECHECK_MS = 15 * 1000;
const known = (c: unknown): c is string => typeof c === 'string' && c !== '' && c !== 'unknown' && c !== 'dev';

// Asks the server which commit it runs and reports an update when it differs from this page's build.
// A mismatch must be seen twice (a deploy in progress can disagree for a moment), the second look comes quickly.
export function useUpdateCheck() {
  const [serverCommit, setServerCommit] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const seen = useRef({ commit: '', count: 0 });
  const recheck = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    try {
      const res = await fetch('/api/health', { cache: 'no-store' });
      if (!res.ok) return;
      const { commit } = await res.json();
      if (!known(commit) || !known(BUILD.commit) || commit === BUILD.commit) {
        seen.current = { commit: '', count: 0 };
        setServerCommit(null);
        return;
      }
      seen.current =
        seen.current.commit === commit ? { commit, count: seen.current.count + 1 } : { commit, count: 1 };
      if (seen.current.count >= 2) {
        setServerCommit(commit);
      } else {
        if (recheck.current) clearTimeout(recheck.current);
        recheck.current = setTimeout(check, RECHECK_MS);
      }
    } catch {
      /* offline: try again later */
    }
  }, []);

  useEffect(() => {
    check();
    const timer = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(timer);
      if (recheck.current) clearTimeout(recheck.current);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [check]);

  return {
    updateAvailable: !!serverCommit && serverCommit !== dismissed,
    serverCommit,
    dismiss: () => setDismissed(serverCommit),
  };
}

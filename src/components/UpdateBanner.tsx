import React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext.js';
import { useUpdateCheck } from '../hooks/useUpdateCheck.js';

// Drop the service worker and its caches first, otherwise a plain reload can serve the old bundle again
async function reloadFresh() {
  try {
    const regs = (await navigator.serviceWorker?.getRegistrations?.()) ?? [];
    await Promise.all(regs.map((r) => r.unregister()));
    if ('caches' in window) await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  } catch {
    /* reload anyway */
  }
  window.location.reload();
}

export const UpdateBanner: React.FC = () => {
  const { lang } = useLanguage();
  const { updateAvailable, serverCommit, dismiss } = useUpdateCheck();
  if (!updateAvailable) return null;
  const vi = lang === 'vi';

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-3 px-4 py-2 text-sm bg-mint text-carbon dark:bg-mint/15 dark:text-mint"
    >
      <span className="min-w-0">
        {vi ? 'Đã có phiên bản mới' : 'A new version is available'} <span className="font-mono">({serverCommit})</span>
      </span>
      <button
        onClick={reloadFresh}
        className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-carbon text-white dark:bg-mint dark:text-carbon font-bold text-xs cursor-pointer"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        {vi ? 'Tải lại ngay' : 'Reload now'}
      </button>
      <button
        onClick={dismiss}
        aria-label={vi ? 'Để sau' : 'Later'}
        className="shrink-0 p-1 rounded-lg opacity-70 hover:opacity-100 cursor-pointer"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

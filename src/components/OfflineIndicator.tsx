import React, { useEffect, useState } from 'react';
import { useOnlineStatus } from '../hooks/useOnlineStatus.js';
import { useLanguage } from '../context/LanguageContext.js';
import { api } from '../services/api.js';
import { WifiOff, RefreshCw } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { lang, t } = useLanguage();
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const updateCount = () => {
      setOfflineQueueCount(api.getOfflineQueue().length);
    };
    updateCount();
    const interval = setInterval(updateCount, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isOnline && offlineQueueCount > 0 && !syncing) {
      setSyncing(true);
      api.syncOfflineQueue().then(() => {
        setOfflineQueueCount(api.getOfflineQueue().length);
        setSyncing(false);
      });
    }
  }, [isOnline, offlineQueueCount, syncing]);

  if (isOnline && offlineQueueCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2.5 rounded-xl bg-amber-600/95 backdrop-blur-md px-4 py-2 text-xs font-semibold text-white shadow-xl border border-amber-400/30">
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4 text-amber-200 animate-pulse" />
          <span>{t.offlineBanner}</span>
        </>
      ) : (
        <>
          <RefreshCw className={`w-4 h-4 text-white ${syncing ? 'animate-spin' : ''}`} />
          <span>
            {lang === 'vi'
              ? `Đang đồng bộ ${offlineQueueCount} lượt check-in offline lên server...`
              : `Syncing ${offlineQueueCount} offline check-in records to server...`}
          </span>
        </>
      )}
    </div>
  );
};

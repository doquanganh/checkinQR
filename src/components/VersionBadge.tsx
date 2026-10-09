import React from 'react';
import { BUILD } from '../buildInfo.js';

// "v2.2.0 · 7f581dd · 09/10/2026 10:40": which build this screen is running
export const VersionBadge: React.FC<{ className?: string }> = ({ className = '' }) => {
  const when = new Date(BUILD.builtAt);
  const p = (n: number) => String(n).padStart(2, '0');
  // fixed dd/mm/yyyy hh:mm in the viewer's local time, the same for both languages
  const date = Number.isNaN(when.getTime())
    ? ''
    : `${p(when.getDate())}/${p(when.getMonth() + 1)}/${when.getFullYear()} ${p(when.getHours())}:${p(when.getMinutes())}`;

  return (
    <p
      className={`text-xs text-fg-subtle font-mono text-center select-text ${className}`}
      title={`Version ${BUILD.version} • commit ${BUILD.commit} • built ${BUILD.builtAt}`}
    >
      v{BUILD.version} · {BUILD.commit}
      {date ? ` · ${date}` : ''}
    </p>
  );
};

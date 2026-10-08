import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext.js';
import { useLanguage } from '../context/LanguageContext.js';

export const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { theme, toggleTheme } = useTheme();
  const { lang } = useLanguage();
  const dark = theme === 'dark';
  const label = dark
    ? lang === 'vi' ? 'Chuyển sang giao diện sáng' : 'Switch to light theme'
    : lang === 'vi' ? 'Chuyển sang giao diện tối' : 'Switch to dark theme';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center w-10 h-10 rounded-xl border border-line bg-surface text-fg-muted hover:text-fg hover:bg-surface-2 transition cursor-pointer ${className}`}
    >
      {dark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
};

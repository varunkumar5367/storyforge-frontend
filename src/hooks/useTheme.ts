// src/hooks/useTheme.ts
'use client';

import { useState, useEffect, useCallback } from 'react';

export type Theme = 'dark' | 'light';

export function useTheme() {
  const [theme, setTheme] = useState<Theme>('dark');

  const applyTheme = useCallback((t: Theme) => {
    document.documentElement.setAttribute('data-theme', t);
    setTheme(t);
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('theme') as Theme | null;
    const initial: Theme = saved ?? 'dark';
    applyTheme(initial);

    const handleChange = () => {
      const current = localStorage.getItem('theme') as Theme | null;
      applyTheme(current ?? 'dark');
    };

    window.addEventListener('theme-changed', handleChange);
    return () => window.removeEventListener('theme-changed', handleChange);
  }, [applyTheme]);

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', next);
    applyTheme(next);
    window.dispatchEvent(new CustomEvent('theme-changed'));
  }, [theme, applyTheme]);

  return { theme, toggleTheme };
}

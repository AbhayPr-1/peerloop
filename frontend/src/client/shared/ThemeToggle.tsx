import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('peerloop_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    }
    return 'dark'; // Web3-first dark mode default
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    try {
      localStorage.setItem('peerloop_theme', theme);
    } catch (_) {
      // Ignore storage restrictions
    }
  }, [theme]);

  return (
    <label className="theme-switch" htmlFor="theme-toggle" title={`${theme === 'dark' ? 'Dark' : 'Light'} mode`}>
      <input
        type="checkbox"
        id="theme-toggle"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        checked={theme === 'light'}
        onChange={(event) => setTheme(event.currentTarget.checked ? 'light' : 'dark')}
      />
      <div className="slider round" />
    </label>
  );
}

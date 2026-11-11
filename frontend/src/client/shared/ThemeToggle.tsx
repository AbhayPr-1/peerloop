import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const stored = window.localStorage.getItem('peerloop_theme');
      if (stored === 'light' || stored === 'dark') return stored;
    } catch (_) {
      // Ignore storage restrictions and use the default theme.
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
        role="switch"
        aria-checked={theme === 'light'}
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        checked={theme === 'light'}
        onChange={(event) => setTheme(event.currentTarget.checked ? 'light' : 'dark')}
      />
      <span className="slider round" aria-hidden="true">
        <svg className="theme-icon theme-icon--moon" viewBox="0 0 24 24" fill="none">
          <path d="M20.1 15.2A8.4 8.4 0 0 1 8.8 3.9a8.5 8.5 0 1 0 11.3 11.3Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <svg className="theme-icon theme-icon--sun" viewBox="-6 -6 36 36" fill="none">
          <path d="M12-5.5v3.2m0 28.8v3.2M-5.5 12h3.2m28.8 0h3.2M-.7-.7l2.3 2.3m20.8 20.8 2.3 2.3m0-25.4-2.3 2.3M1.6 22.4l-2.3 2.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <circle cx="12" cy="12" r="12.8" fill="#fff0bc" />
        </svg>
      </span>
    </label>
  );
}

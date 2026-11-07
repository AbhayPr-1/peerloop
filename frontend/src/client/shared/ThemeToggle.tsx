import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    const savedTheme = localStorage.getItem('theme');
    return savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <label className="theme-switch" htmlFor="theme-toggle" title={`${theme === 'dark' ? 'Dark' : 'Light'} mode`}>
      <input
        type="checkbox"
        id="theme-toggle"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        checked={theme !== 'dark'}
        onChange={(event) => setTheme(event.currentTarget.checked ? 'light' : 'dark')}
      />
      <div className="slider round" />
    </label>
  );
}

// frontend/js/theme.js
document.addEventListener('DOMContentLoaded', () => {
    const themeToggle = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;
    function setTheme(theme) {
        htmlEl.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
        themeToggle.checked = (theme !== 'dark');
    }
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        setTheme(savedTheme);
    } else {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(prefersDark ? 'dark' : 'light');
    }
    themeToggle.addEventListener('change', () => {
        setTheme(themeToggle.checked ? 'light' : 'dark');
    });
});
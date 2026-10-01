/**
 * Dark Mode Toggle
 *
 * Logic:
 * 1. Check localStorage for saved preference.
 * 2. If none, fall back to prefers-color-scheme media query.
 * 3. Apply the theme by setting data-theme on <html>.
 * 4. Toggle between light / dark on button click.
 */

const STORAGE_KEY = 'theme-preference';

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function getSavedTheme() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveTheme(theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // localStorage unavailable — silently ignore
  }
}

function applyTheme(theme) {
  if (theme === 'dark') {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function initTheme() {
  const saved = getSavedTheme();
  const theme = saved ?? getSystemTheme();
  applyTheme(theme);

  // Stay in sync if the user changes the OS setting
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    if (!getSavedTheme()) {
      applyTheme(e.matches ? 'dark' : 'light');
    }
  });
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  saveTheme(next);
}

// ── bootstrap ───────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  document.getElementById('theme-toggle').addEventListener('click', toggleTheme);

  // CTA button just for demo
  document.getElementById('cta-btn').addEventListener('click', () => {
    alert('Welcome! 🎉  Dark mode is working — try the toggle in the top-right corner.');
  });
});

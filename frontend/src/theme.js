import { useSyncExternalStore } from 'react';

// Light is the default theme; dark is the original black + amber look.
// The choice is saved per browser and applied as <html data-theme="...">,
// which switches the CSS variables in index.css.
const STORAGE_KEY = 'agentic-analyst-theme';
const listeners = new Set();

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

let current = readSaved();
document.documentElement.dataset.theme = current;

export function setTheme(theme) {
  current = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.dataset.theme = current;
  try {
    localStorage.setItem(STORAGE_KEY, current);
  } catch {
    // Storage blocked (private mode): the theme still applies for this visit.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Returns [theme, setTheme]; components re-render when the theme changes. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => current);
  return [theme, setTheme];
}

/** Reads a CSS variable from the active theme (e.g. for Plotly colours). */
export function themeColor(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

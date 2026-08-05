"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

/**
 * Runs before first paint (injected in <head>) so the correct theme class is
 * on <html> from the very first frame. Without this the page paints light,
 * then snaps to dark once React hydrates — the classic dark-mode flash.
 */
export const THEME_INIT_SCRIPT = `
(function () {
  try {
    var stored = localStorage.getItem('theme');
    var dark = stored
      ? stored === 'dark'
      : window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (dark) document.documentElement.classList.add('dark');
  } catch (e) {}
})();
`;

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // Private mode / storage disabled — the toggle still works for this
    // session, it just won't be remembered.
  }
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  // Read the real state off the DOM, which the init script already set.
  useEffect(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "dark" : "light");
  }, []);

  // Follow the OS while the user hasn't made an explicit choice.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (e: MediaQueryListEvent) => {
      try {
        if (localStorage.getItem("theme")) return;
      } catch {
        /* fall through and follow the OS */
      }
      const next: Theme = e.matches ? "dark" : "light";
      setTheme(next);
      document.documentElement.classList.toggle("dark", next === "dark");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      // Rendered before hydration resolves the theme; aria-label stays
      // generic until then so a screen reader never announces the wrong one.
      aria-label={
        theme === null
          ? "Toggle theme"
          : theme === "dark"
            ? "Switch to light mode"
            : "Switch to dark mode"
      }
      title="Toggle theme"
      className="flex h-8 w-8 items-center justify-center rounded-md text-[color:var(--ink-muted)] transition hover:bg-[color:var(--mist)] hover:text-[color:var(--ink)]"
    >
      {/* Both icons are always in the DOM; CSS picks one, so the button is
          correct at first paint without waiting for JS state. */}
      <svg
        className="hidden h-4 w-4 dark:block"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      </svg>
      <svg
        className="h-4 w-4 dark:hidden"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
      >
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}

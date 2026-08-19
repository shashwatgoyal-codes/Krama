"use client";

/**
 * No React state on purpose.
 *
 * The theme lives in one place — the `data-theme` attribute, set before
 * first paint by the inline script in app/layout.tsx. Mirroring it into
 * state would mean the server rendering one icon and the client another,
 * so CSS decides which icon shows and the click handler reads the DOM.
 */
function currentTheme(): "light" | "dark" {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export default function ThemeToggle() {
  function toggle() {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("krama-theme", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Switch between light and dark"
      className="theme-toggle grid size-[30px] cursor-pointer place-items-center rounded-md border border-ln2 text-mut transition-colors hover:border-acc hover:text-acc"
    >
      <svg className="icon-sun" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
        <circle cx="12" cy="12" r="4.2" />
        <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4" />
      </svg>
      <svg className="icon-moon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
      </svg>
    </button>
  );
}

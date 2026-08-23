"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";
import {
  ENV_LABEL,
  ENV_STYLE,
  shouldShowEnvBadge,
  type AppEnv,
  appName,
} from "@/lib/env";

const NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/notes", label: "Notes" },
  { href: "/app/calendar", label: "Calendar" },
  { href: "/app/explore", label: "Explore" },
  { href: "/app/rewards", label: "Rewards" },
];

export default function TopBar({
  env,
  name,
  avatar,
}: {
  env: AppEnv;
  name: string;
  /** Src for the uploaded picture, or null for the initial. */
  avatar: string | null;
}) {
  const pathname = usePathname();

  return (
    /*
     * Two rows on a phone, one on anything wider.
     *
     * Six destinations plus search, theme and an avatar do not fit in
     * 375px, and forcing them into one row pushed the whole page to
     * 682px wide — every screen scrolled sideways, not just the header.
     * The nav gets its own scrolling strip below the brand instead, so
     * nothing is unreachable and nothing drags the page with it.
     */
    <header className="flex-none border-b border-ln bg-surf">
      <div className="flex h-12 items-center gap-3.5 px-4">
      <span className="font-display text-[14.5px] font-semibold tracking-[-0.015em]">
        {appName(env)}
      </span>

      {shouldShowEnvBadge(env) && (
        <span
          title={`You are looking at the ${ENV_LABEL[env]} environment`}
          className={`label-xs -ml-1.5 rounded border px-[5px] py-0.5 ${ENV_STYLE[env]}`}
        >
          {ENV_LABEL[env]}
        </span>
      )}

      {/* Wide screens keep the nav inline. */}
      <nav className="hidden gap-[3px] md:flex">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "rounded-md px-2.5 py-[5px] text-[12.5px] transition-colors " +
                (active
                  ? "bg-acc-soft font-semibold text-acc"
                  : "font-medium text-mut hover:bg-surf2 hover:text-ink")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-2.5">
        {/* A real control this time. The key hint that used to sit here
            was a label with nothing behind it. */}
        <Link
          href="/app/search"
          aria-label="Search"
          aria-current={pathname === "/app/search" ? "page" : undefined}
          className={
            "rounded-md px-2 py-1 text-[12.5px] transition-colors " +
            (pathname === "/app/search"
              ? "bg-acc-soft font-semibold text-acc"
              : "font-medium text-mut hover:bg-surf2 hover:text-ink")
          }
        >
          Search
        </Link>
        <ThemeToggle />
        <Link
          href="/app/profile"
          aria-label={`Profile — signed in as ${name}`}
          aria-current={pathname === "/app/profile" ? "page" : undefined}
          title={name}
          className={
            "grid size-[26px] flex-none place-items-center rounded-full bg-acc " +
            "text-[11px] font-bold text-on-acc transition-shadow hover:ring-2 " +
            "hover:ring-acc-soft " +
            (pathname === "/app/profile"
              ? "ring-2 ring-acc ring-offset-2 ring-offset-surf"
              : "")
          }
        >
          {avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatar}
              alt=""
              width={26}
              height={26}
              className="size-full rounded-full object-cover"
            />
          ) : (
            name.charAt(0).toUpperCase()
          )}
        </Link>
      </div>
      </div>

      {/* Narrow screens get the nav on its own line, scrolling sideways
          rather than dragging the whole page with it. */}
      <nav className="scrollbar-none flex gap-[3px] overflow-x-auto border-t border-ln px-3 py-1.5 md:hidden">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={
                "flex-none rounded-md px-2.5 py-1 text-[12.5px] transition-colors " +
                (active
                  ? "bg-acc-soft font-semibold text-acc"
                  : "font-medium text-mut hover:bg-surf2 hover:text-ink")
              }
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "./ThemeToggle";

const NAV = [
  { href: "/app", label: "Today" },
  { href: "/app/tasks", label: "Tasks" },
  { href: "/app/notes", label: "Notes" },
  { href: "/app/calendar", label: "Calendar" },
  { href: "/app/explore", label: "Explore" },
];

export default function TopBar() {
  const pathname = usePathname();

  return (
    <header className="flex h-12 flex-none items-center gap-3.5 border-b border-ln bg-surf px-4">
      <span className="font-display text-[14.5px] font-semibold tracking-[-0.015em]">
        Krama
      </span>

      <nav className="flex gap-[3px]">
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
        <span className="rounded border border-ln2 px-[5px] py-0.5 font-mono text-[10px] text-fai">
          ⌘K
        </span>
        <ThemeToggle />
        <span
          className="grid size-[26px] flex-none place-items-center rounded-full bg-acc text-[11px] font-bold text-on-acc"
          title="Shashwat"
        >
          S
        </span>
      </div>
    </header>
  );
}

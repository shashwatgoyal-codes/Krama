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
    <header className="topbar">
      <span className="mark">Krama</span>

      <nav className="tnav">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={pathname === item.href ? "page" : undefined}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="tright">
        <span className="kbd">⌘K</span>
        <ThemeToggle />
        <span className="av" title="Shashwat">
          S
        </span>
      </div>
    </header>
  );
}

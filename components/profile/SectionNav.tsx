import Link from "next/link";

/**
 * The settings section list, as drawn: sections on the left, the one
 * you picked on the right.
 *
 * Driven by the URL rather than client state, so a section is linkable,
 * survives a reload, and renders on the server — a settings page that
 * loses your place on refresh is a small betrayal.
 */

export const SECTIONS = [
  { key: "profile", label: "Profile" },
  { key: "scoring", label: "Scoring" },
  { key: "rhythm", label: "Rhythm" },
  { key: "areas", label: "Areas & tags" },
  { key: "appearance", label: "Appearance" },
  { key: "data", label: "Data" },
] as const;

export type SectionKey = (typeof SECTIONS)[number]["key"];

export function isSectionKey(value: string | undefined): value is SectionKey {
  return SECTIONS.some((s) => s.key === value);
}

export default function SectionNav({ active }: { active: SectionKey }) {
  return (
    <nav
      aria-label="Settings sections"
      className="flex gap-1 overflow-x-auto md:flex-col md:gap-0.5 md:overflow-visible"
    >
      {SECTIONS.map((section) => {
        const on = section.key === active;
        return (
          <Link
            key={section.key}
            href={`/app/profile?s=${section.key}`}
            aria-current={on ? "page" : undefined}
            className={
              "flex-none whitespace-nowrap rounded-md px-2.5 py-[7px] text-[12.5px] transition-colors " +
              (on
                ? "bg-acc-soft font-semibold text-acc"
                : "font-medium text-mut hover:bg-surf2 hover:text-ink")
            }
          >
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}

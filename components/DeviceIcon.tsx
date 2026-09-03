import type { DeviceKind } from "@/lib/devices";

/**
 * A picture of the kind of thing, not the make of it.
 *
 * The list exists so you can spot a device that is not yours, and shape
 * is what the eye sorts by first — a phone among laptops stands out
 * before you have read a word. Deliberately generic: guessing "MacBook
 * Air" from a user-agent is not something you can do reliably, and a
 * confident wrong answer makes the whole list less trustworthy.
 */
export default function DeviceIcon({ kind }: { kind: DeviceKind }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };

  if (kind === "phone") {
    return (
      <svg {...common}>
        <rect x="7" y="2.5" width="10" height="19" rx="2.2" />
        <line x1="10.6" y1="18.4" x2="13.4" y2="18.4" />
      </svg>
    );
  }

  if (kind === "tablet") {
    return (
      <svg {...common}>
        <rect x="4.5" y="2.5" width="15" height="19" rx="2.2" />
        <line x1="10.4" y1="18.6" x2="13.6" y2="18.6" />
      </svg>
    );
  }

  if (kind === "laptop") {
    return (
      <svg {...common}>
        <rect x="4" y="5" width="16" height="10.5" rx="1.6" />
        <path d="M2 18.5h20" />
      </svg>
    );
  }

  // Unknown: a question rather than a wrong guess.
  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.3 2.4c-.6.2-.9.7-.9 1.3v.4" />
      <line x1="12" y1="16.8" x2="12" y2="16.9" />
    </svg>
  );
}

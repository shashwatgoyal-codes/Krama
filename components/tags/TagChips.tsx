import type { TagChip } from "@/lib/tags";

/**
 * A row of tags, read-only.
 *
 * Colour comes from the tag itself rather than the surrounding context,
 * because the point of colouring a tag in Settings is that you recognise
 * it in a list without reading it.
 */
export default function TagChips({
  tags,
  max,
  size = "sm",
}: {
  tags: TagChip[];
  /** Show at most this many, then "+N". Unset shows all. */
  max?: number;
  size?: "xs" | "sm";
}) {
  if (tags.length === 0) return null;

  const shown = max ? tags.slice(0, max) : tags;
  const hidden = tags.length - shown.length;

  const pad = size === "xs" ? "px-1.5 py-0" : "px-2 py-0.5";
  const text = size === "xs" ? "text-[10px]" : "text-[11px]";

  return (
    <div className="flex flex-wrap items-center gap-1">
      {shown.map((tag) => (
        <span
          key={tag.id}
          className={`rounded-full border ${pad} ${text} font-semibold`}
          style={{
            borderColor: `var(--${tag.colour})`,
            color: `var(--${tag.colour})`,
          }}
        >
          {tag.name}
        </span>
      ))}
      {hidden > 0 && (
        <span className={`${text} font-semibold text-fai`}>+{hidden}</span>
      )}
    </div>
  );
}

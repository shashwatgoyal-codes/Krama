"use client";

import { useEffect, useRef, useState } from "react";
import {
  parseTagInput,
  mergeTags,
  removeTag,
  sameTag,
  TAG_MAX_LENGTH,
  type TagChip,
} from "@/lib/tags";

/**
 * Picking tags for one piece of content.
 *
 * Typing and picking are the same control on purpose. A dropdown alone
 * means you can only use tags you already thought of, and a text box
 * alone means you retype "interviews" slightly differently until you
 * have three of them. So: existing tags are one click, anything new is
 * typed, and both end up in the same hidden field.
 *
 * That field is a comma-separated list of names rather than ids, because
 * a name that doesn't exist yet has no id — the server resolves names to
 * rows and creates what's missing.
 */
export default function TagField({
  name = "tags",
  selected,
  available,
  disabled,
}: {
  name?: string;
  /** Tags currently on this item. */
  selected: TagChip[];
  /** Every tag this user has, for one-click reuse. */
  available: TagChip[];
  disabled?: boolean;
}) {
  const [chosen, setChosen] = useState<string[]>(selected.map((t) => t.name));
  const [draft, setDraft] = useState("");
  const hidden = useRef<HTMLInputElement>(null);
  const firstRender = useRef(true);

  // Same reason the stepper does this: React writing a hidden input's
  // value fires no native event, so a form watching for changes would
  // never notice and would keep its Save button hidden.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    hidden.current?.dispatchEvent(new Event("input", { bubbles: true }));
  }, [chosen]);

  function commitDraft() {
    const names = parseTagInput(draft);
    if (names.length === 0) return;
    setChosen((c) => mergeTags(c, names));
    setDraft("");
  }

  const colourOf = (label: string) =>
    [...available, ...selected].find((t) => sameTag(t.name, label))?.colour ??
    "mut";

  // Only tags not already on the item are worth offering.
  const offerable = available.filter(
    (t) => !chosen.some((c) => sameTag(c, t.name)),
  );

  return (
    <div>
      <input ref={hidden} type="hidden" name={name} value={chosen.join(", ")} />

      {chosen.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {chosen.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold"
              style={{
                borderColor: `var(--${colourOf(label)})`,
                color: `var(--${colourOf(label)})`,
              }}
            >
              {label}
              <button
                type="button"
                disabled={disabled}
                aria-label={`Remove ${label}`}
                onClick={() => setChosen((c) => removeTag(c, label))}
                className="cursor-pointer text-[13px] leading-none opacity-60 hover:opacity-100 disabled:cursor-not-allowed"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <input
        value={draft}
        disabled={disabled}
        maxLength={TAG_MAX_LENGTH * 4}
        placeholder={chosen.length ? "Another tag…" : "Add a tag…"}
        aria-label="Add a tag"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commitDraft}
        onKeyDown={(e) => {
          // Enter and comma both finish a tag. Enter must not submit the
          // form around this — half-typed tags becoming saves is worse
          // than an extra keystroke.
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitDraft();
          }
          // Backspace on an empty box takes the last chip off, which is
          // what every other tag input in the world does.
          if (e.key === "Backspace" && draft === "" && chosen.length > 0) {
            setChosen((c) => c.slice(0, -1));
          }
        }}
        className="w-full rounded-md border border-ln2 bg-surf px-2 py-1.5 text-[12.5px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft disabled:opacity-60"
      />

      {offerable.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {offerable.slice(0, 12).map((tag) => (
            <button
              key={tag.id}
              type="button"
              disabled={disabled}
              onClick={() => setChosen((c) => mergeTags(c, [tag.name]))}
              className="cursor-pointer rounded-full border border-ln2 px-2 py-0.5 text-[11px] text-mut transition-colors hover:border-acc hover:text-acc disabled:cursor-not-allowed"
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

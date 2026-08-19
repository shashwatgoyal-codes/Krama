"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { TagChip } from "@/lib/tags";

/**
 * The search box.
 *
 * Submits on enter rather than on every keystroke: this reads four
 * tables, and firing that at typing speed would spend most of its
 * queries on prefixes of a word nobody meant to search for.
 */
export default function SearchBox({
  initial,
  tags,
}: {
  initial: string;
  tags: TagChip[];
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial);
  const input = useRef<HTMLInputElement>(null);

  // "/" focuses search, the one shortcut worth having on this page. It
  // must not steal the key while you are typing into something else.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (e.key === "/" && !typing) {
        e.preventDefault();
        input.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function go(next: string) {
    const q = next.trim();
    router.push(q ? `/app/search?q=${encodeURIComponent(q)}` : "/app/search");
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(value);
        }}
        className="flex gap-2"
      >
        <input
          ref={input}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoFocus
          placeholder="Search everything…"
          aria-label="Search"
          className="min-w-0 flex-1 rounded-[9px] border border-ln2 bg-surf px-[11px] py-2 text-[13px] text-ink placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft"
        />
        <button
          type="submit"
          className="cursor-pointer rounded-[9px] border border-ink bg-ink px-3.5 py-2 text-[12.5px] font-semibold text-paper transition-colors hover:border-ink2 hover:bg-ink2"
        >
          Search
        </button>
      </form>

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="label-xs mr-0.5">Tags</span>
          {tags.slice(0, 10).map((tag) => (
            <button
              key={tag.id}
              type="button"
              onClick={() => {
                const next = `tag:${tag.name}`;
                setValue(next);
                go(next);
              }}
              className="cursor-pointer rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-opacity hover:opacity-70"
              style={{
                borderColor: `var(--${tag.colour})`,
                color: `var(--${tag.colour})`,
              }}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

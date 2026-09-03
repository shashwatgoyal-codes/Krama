"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { captureText } from "@/app/app/inbox/actions";
import { isCapturable, suggest, SUGGESTION_LABEL } from "@/lib/capture";

/**
 * ⌘K anywhere, type, done.
 *
 * The whole value is in what it does *not* ask. No area, no tag, no
 * points, no decision about whether this is a task or a note — because
 * at the moment a thought arrives you are in the middle of something
 * else, and every question is a reason to close the box and lose it.
 * Triage happens later, in the inbox, when you have attention to spare.
 *
 * Nothing here is a route change: opening a dialog rather than
 * navigating means the page you were on is still there behind it, which
 * is the difference between capturing a thought and abandoning a task.
 */
export default function QuickCapture() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // metaKey on a Mac, ctrlKey everywhere else. Both, rather than
      // sniffing the platform, because a Mac with an external PC keyboard
      // is a real thing and guessing wrong makes the feature invisible.
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((wasOpen) => {
          // Reset here rather than in an effect on `open`. Setting state
          // synchronously inside an effect makes React render twice for
          // every open, and this is the moment the state actually changes.
          if (!wasOpen) {
            setSaved(false);
            setError(null);
          }
          return !wasOpen;
        });
        return;
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    // Focus only — no state changes here. After paint, or the first
    // keystroke lands nowhere.
    if (open) requestAnimationFrame(() => box.current?.focus());
  }, [open]);

  if (!open) return null;

  const ready = isCapturable(text);
  const guess = ready ? suggest(text) : null;

  function submit() {
    if (!ready || pending) return;
    start(async () => {
      const fd = new FormData();
      fd.set("text", text);
      const result = await captureText(fd);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setText("");
      setSaved(true);
      router.refresh();
      // Left open briefly on purpose: thoughts arrive in threes, and
      // reopening the box is friction exactly when you are mid-flow.
      setTimeout(() => setOpen(false), 900);
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Quick capture"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 px-4 pt-[14vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="glass w-full max-w-[520px] rounded-xl">
        <textarea
          ref={box}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends; Shift+Enter is a new line. The common case is
            // one line, so it should not need a modifier.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder="What's on your mind?"
          className="w-full resize-none rounded-t-xl bg-transparent px-4 py-3.5 text-[14px] placeholder:text-fai focus:outline-none"
        />

        <div className="flex items-center gap-3 border-t border-ln px-4 py-2">
          <span className="text-[11px] text-fai">
            {saved
              ? "Saved to your inbox"
              : guess
                ? `Looks like: ${SUGGESTION_LABEL[guess].toLowerCase()} — decide later`
                : "Enter to save · Esc to close"}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={!ready || pending}
            className="ml-auto rounded-md bg-ink px-3 py-1 text-[12px] font-semibold text-paper disabled:opacity-40"
          >
            {pending ? "Saving…" : "Capture"}
          </button>
        </div>

        {error && <p className="px-4 pb-2 text-[11.5px] text-bad">{error}</p>}
      </div>
    </div>
  );
}

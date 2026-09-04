"use client";

import { useState, useTransition } from "react";
import { useToast } from "@/components/ui/Toast";
import { replyToFeedback, markFeedback } from "./actions";
import type { FeedbackRow as Row } from "@/lib/admin/queries";

const KIND: Record<string, string> = {
  idea: "Idea",
  problem: "Problem",
  praise: "Praise",
  other: "Other",
};

const STATUS: Record<string, string> = {
  new: "Waiting",
  read: "Seen",
  done: "Answered",
};

/**
 * One message, and what an administrator can do with it.
 *
 * The reply box is closed until asked for. A textarea open beside every
 * row turns a queue into a wall of empty boxes, and makes the one you are
 * actually answering hard to find.
 */
export default function FeedbackRow({ row }: { row: Row }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [reply, setReply] = useState(row.reply ?? "");
  const [pending, startTransition] = useTransition();

  function send(formData: FormData) {
    startTransition(async () => {
      const result = await replyToFeedback(formData);
      if (result.ok) {
        toast.success("Reply sent.");
        setOpen(false);
      } else toast.error(result.error);
    });
  }

  function mark(formData: FormData) {
    startTransition(async () => {
      const result = await markFeedback(formData);
      if (result.ok) toast.success("Updated.");
      else toast.error(result.error);
    });
  }

  return (
    <li className="border-b border-ln px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2">
        <span
          className={
            "label-xs rounded px-[5px] py-0.5 " +
            (row.status === "done"
              ? "bg-ok-soft text-ok"
              : row.status === "read"
                ? "bg-acc-soft text-acc"
                : "border border-warn bg-warn-soft text-warn")
          }
        >
          {STATUS[row.status] ?? row.status}
        </span>
        <span className="text-[11.5px] font-semibold text-mut">
          {KIND[row.kind] ?? row.kind}
        </span>
        <span className="text-[11.5px] text-ink2" title={row.email}>
          {row.name ?? row.email}
        </span>
        {row.fromPath && (
          <code className="rounded bg-surf2 px-1 py-0.5 text-[10.5px] text-fai">
            {row.fromPath}
          </code>
        )}
        <span className="ml-auto text-[11px] text-fai">
          {row.createdAt.toLocaleDateString("en-GB", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </span>
      </div>

      <p className="mt-2 max-w-[80ch] whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink">
        {row.message}
      </p>

      {row.reply && !open && (
        <div className="mt-2 max-w-[80ch] border-l-2 border-acc pl-2.5">
          <p className="label-xs text-acc">
            Replied{row.handledBy ? ` by ${row.handledBy}` : ""}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink2">
            {row.reply}
          </p>
        </div>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="cursor-pointer rounded-md border border-ln2 px-2 py-1 text-[11.5px] font-medium text-mut transition-colors hover:bg-surf2 hover:text-ink"
        >
          {open ? "Cancel" : row.reply ? "Edit reply" : "Reply"}
        </button>

        {row.status === "new" && (
          <form action={mark}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="status" value="read" />
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-md border border-ln2 px-2 py-1 text-[11.5px] font-medium text-mut transition-colors hover:bg-surf2 hover:text-ink disabled:opacity-50"
            >
              Mark seen
            </button>
          </form>
        )}

        {row.status !== "done" && (
          <form action={mark}>
            <input type="hidden" name="id" value={row.id} />
            <input type="hidden" name="status" value="done" />
            <button
              type="submit"
              disabled={pending}
              className="cursor-pointer rounded-md border border-ln2 px-2 py-1 text-[11.5px] font-medium text-mut transition-colors hover:bg-surf2 hover:text-ink disabled:opacity-50"
            >
              Mark answered
            </button>
          </form>
        )}
      </div>

      {open && (
        <form action={send} className="mt-2.5 max-w-[80ch]">
          <input type="hidden" name="id" value={row.id} />
          <textarea
            name="reply"
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="They will see this in their settings."
            aria-label="Your reply"
            className="field w-full resize-y leading-relaxed resize-y leading-relaxed"
          />
          <button
            type="submit"
            disabled={pending}
            className="mt-2 cursor-pointer rounded-md border border-ink bg-ink px-3 py-1.5 text-[12px] font-semibold text-paper transition-colors hover:bg-ink2 disabled:opacity-50"
          >
            {pending ? "Sending…" : "Send reply"}
          </button>
        </form>
      )}
    </li>
  );
}

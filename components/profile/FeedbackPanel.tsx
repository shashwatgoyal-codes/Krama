"use client";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import {
  submitFeedback,
  takeBackFeedback,
} from "@/app/app/profile/feedback-actions";
import {
  FEEDBACK_KINDS,
  KIND_LABEL,
  STATUS_LABEL,
  MAX_MESSAGE,
  type FeedbackMine,
} from "@/lib/feedback";

/**
 * Telling whoever runs Krama something, and seeing what came back.
 *
 * The list underneath is the part that matters. Feedback that vanishes on
 * send is indistinguishable from feedback nobody received, so a person can
 * see their own messages, whether they have been read, and any reply —
 * without being emailed about it.
 */
export default function FeedbackPanel({ mine }: { mine: FeedbackMine[] }) {
  const toast = useToast();
  const [kind, setKind] = useState<string>("idea");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const left = MAX_MESSAGE - message.length;

  function send(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await submitFeedback(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("");
      toast.success("Sent. Thank you.");
    });
  }

  function takeBack(formData: FormData) {
    startTransition(async () => {
      const result = await takeBackFeedback(formData);
      if (result.ok) toast.success("Taken back.");
      else toast.error(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <form action={send} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FEEDBACK_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={
                "cursor-pointer rounded-full border px-3 py-[5px] text-[11.5px] font-medium transition-colors " +
                (kind === k
                  ? "border-ink bg-ink text-paper"
                  : "border-ln2 text-mut hover:border-ink2 hover:text-ink")
              }
            >
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <input type="hidden" name="kind" value={kind} />

        <div>
          <textarea
            name="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={MAX_MESSAGE}
            placeholder="What happened, or what would help?"
            aria-label="Your message"
            className="field w-full resize-y leading-relaxed resize-y leading-relaxed"
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-[11px] text-mut">
              {error ? (
                <span className="text-bad">{error}</span>
              ) : (
                "Only you and whoever runs Krama can see this."
              )}
            </p>
            {/* Silent until it starts to matter. */}
            {left < 200 && <p className="text-[11px] text-fai">{left} left</p>}
          </div>
        </div>

        <div>
          <Button type="submit" disabled={pending || message.trim().length < 4}>
            {pending ? "Sending…" : "Send"}
          </Button>
        </div>
      </form>

      {mine.length > 0 && (
        <div>
          <p className="text-[12px] font-semibold text-ink">
            What you have sent
          </p>
          <ul className="mt-2 flex flex-col gap-2">
            {mine.map((f) => (
              <li
                key={f.id}
                className="rounded-[9px] border border-ln bg-surf2 px-3 py-2.5"
              >
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-semibold text-mut">
                    {KIND_LABEL[f.kind]}
                  </span>
                  <span
                    className={
                      "label-xs rounded px-[5px] py-0.5 " +
                      (f.status === "done"
                        ? "bg-ok-soft text-ok"
                        : f.status === "read"
                          ? "bg-acc-soft text-acc"
                          : "border border-ln2 text-mut")
                    }
                  >
                    {STATUS_LABEL[f.status]}
                  </span>
                  <span className="ml-auto text-[11px] text-fai">
                    {f.createdAt.toLocaleDateString("en-GB", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>

                <p className="mt-1.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink2">
                  {f.message}
                </p>

                {f.reply && (
                  <div className="mt-2 border-l-2 border-acc pl-2.5">
                    <p className="label-xs text-acc">Reply</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[12px] leading-relaxed text-ink2">
                      {f.reply}
                    </p>
                  </div>
                )}

                {/* Once it has been read, taking it back would rewrite
                    what someone already saw. */}
                {f.status === "new" && (
                  <form action={takeBack} className="mt-2">
                    <input type="hidden" name="id" value={f.id} />
                    <button
                      type="submit"
                      disabled={pending}
                      className="cursor-pointer text-[11px] font-medium text-mut underline underline-offset-2 transition-colors hover:text-bad disabled:opacity-50"
                    >
                      Take this back
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

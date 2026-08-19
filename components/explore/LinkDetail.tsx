"use client";

import type { TagChip } from "@/lib/tags";

import { useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import {
  saveLinkDetails,
  toggleRead,
  archiveLink,
  linkToTask,
} from "@/app/app/explore/actions";

export type LinkDetailView = {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  source: string;
  why: string;
  tags: TagChip[];
  read: boolean;
  isTask: boolean;
  /** Shortened for display: "linkedin.com/posts/…" */
  shortUrl: string;
};

const FIELD =
  "w-full rounded-md border border-ln2 bg-surf px-2 py-1.5 text-[12.5px] text-ink " +
  "placeholder:text-fai focus:border-acc focus:outline-none focus:ring-[3px] focus:ring-acc-soft";

export default function LinkDetail({ link }: { link: LinkDetailView }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: (d: FormData) => Promise<{ ok: boolean; error?: string }>) {
    const data = new FormData();
    data.set("id", link.id);
    setError(null);
    startTransition(async () => {
      const result = await action(data);
      if (result && !result.ok && result.error) setError(result.error);
    });
  }

  return (
    <div className="flex min-w-0 flex-col">
      {link.imageUrl ? (
        // Deliberately a plain img: next/image would need every host a
        // user might paste declared up front, which is not a list that
        // can exist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={link.imageUrl}
          alt=""
          className="mb-3 h-[132px] w-full rounded-lg border border-ln object-cover"
        />
      ) : (
        <div className="mb-3 grid h-[132px] w-full place-items-center rounded-lg border border-dashed border-ln2 bg-surf">
          <span className="label-xs">No preview</span>
        </div>
      )}

      <form
        action={(data) => {
          setError(null);
          startTransition(async () => {
            const result = await saveLinkDetails(data);
            if (result.ok) {
              setSaved(true);
              setTimeout(() => setSaved(false), 2200);
            } else setError(result.error);
          });
        }}
        className="flex flex-col gap-3"
      >
        <input type="hidden" name="id" value={link.id} />

        <Field label="Title">
          <input name="title" defaultValue={link.title} className={FIELD} />
        </Field>

        <Field label="Source">
          <a
            href={link.url}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate text-[12px] text-acc hover:underline"
          >
            {link.shortUrl}
          </a>
        </Field>

        <Field label="Why I saved it">
          <textarea
            name="why"
            rows={3}
            defaultValue={link.why}
            placeholder="What made this worth keeping? This is the bit you'll want in three weeks."
            className={`${FIELD} resize-y`}
          />
        </Field>

        <Field label="Tags">
          <input
            name="tags"
            defaultValue={link.tags.map((t) => t.name).join(", ")}
            placeholder="research, career"
            className={FIELD}
          />
          {link.tags.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {link.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="rounded border bg-surf px-1.5 py-0.5 text-[10.5px] font-semibold"
                  style={{
                    borderColor: `var(--${tag.colour})`,
                    color: `var(--${tag.colour})`,
                  }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          )}
        </Field>

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={pending}>
            Save
          </Button>
          <span aria-live="polite" className="text-[11.5px] font-semibold text-ok">
            {saved && "Saved"}
          </span>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap gap-2 border-t border-ln pt-3">
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || link.isTask}
          onClick={() => run(linkToTask)}
          title={link.isTask ? "Already a task" : "Turn this into something to do"}
        >
          {link.isTask ? "Already a task" : "Make a task"}
        </Button>

        <Button type="button" size="sm" disabled={pending} onClick={() => run(toggleRead)}>
          {link.read ? "Mark unread" : "Mark read"}
        </Button>

        <Button type="button" size="sm" disabled={pending} onClick={() => run(archiveLink)}>
          Remove
        </Button>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-bad bg-bad-soft px-2.5 py-2 text-[11.5px] text-ink"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-1 font-mono text-[9.5px] font-semibold uppercase tracking-[0.12em] text-fai">
        {label}
      </div>
      {children}
    </div>
  );
}

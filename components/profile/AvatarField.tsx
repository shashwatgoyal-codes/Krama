"use client";

import { useRef, useState, useTransition } from "react";
import Button from "@/components/ui/Button";
import { uploadAvatar, removeAvatar } from "@/app/app/profile/avatar-actions";
import { AVATAR_MAX_BYTES, formatBytes } from "@/lib/images";

/**
 * The identity block: picture, name, email, and the button that changes
 * the picture.
 *
 * Submits as soon as a file is chosen. A separate "upload" step after
 * "choose file" is a second decision nobody wants to make — they have
 * already decided, by picking the file.
 */
export default function AvatarField({
  userId,
  name,
  email,
  version,
}: {
  userId: string;
  name: string;
  email: string;
  /** Changes when a new image is stored, so the browser refetches. */
  version: number | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const input = useRef<HTMLInputElement>(null);

  const src = version ? `/api/avatar/${userId}?v=${version}` : null;

  function choose(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;

    setError(null);
    const data = new FormData();
    data.set("avatar", file);
    startTransition(async () => {
      const result = await uploadAvatar(data);
      if (!result.ok) setError(result.error);
      if (input.current) input.current.value = "";
    });
  }

  return (
    <div className="border-b border-ln pb-4">
      <div className="flex items-center gap-3">
        {src ? (
          // A plain img: next/image would want every avatar route
          // declared, and this one is our own bytes anyway.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt=""
            width={40}
            height={40}
            className="size-10 flex-none rounded-full border border-ln object-cover"
          />
        ) : (
          <span className="grid size-10 flex-none place-items-center rounded-full bg-acc text-[15px] font-bold text-on-acc">
            {name.charAt(0).toUpperCase()}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-ink">{name}</p>
          <p className="truncate text-[11.5px] text-mut">{email}</p>
        </div>

        <div className="flex flex-none items-center gap-1.5">
          {src && (
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const result = await removeAvatar();
                  if (!result.ok) setError(result.error);
                });
              }}
            >
              Remove
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            disabled={pending}
            onClick={() => input.current?.click()}
          >
            {pending ? "Uploading…" : src ? "Change photo" : "Add a photo"}
          </Button>
        </div>
      </div>

      {/* Outside any form, so choosing a file can't submit the profile
          form it happens to sit inside. */}
      <input
        ref={input}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label="Choose a profile photo"
        onChange={(e) => choose(e.target.files)}
      />

      {error ? (
        <p role="alert" className="mt-2 text-[11.5px] text-bad">
          {error}
        </p>
      ) : (
        <p className="mt-2 text-[11px] text-fai">
          PNG, JPEG or WebP, up to {formatBytes(AVATAR_MAX_BYTES)}.
        </p>
      )}
    </div>
  );
}

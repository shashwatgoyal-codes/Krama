"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The avatar, with somewhere to go from it.
 *
 * It used to be a plain link straight to the profile page, which meant
 * the only route to signing out was landing on a settings screen first
 * and hunting for it.
 *
 * Opens on hover for a mouse and on click for everything else. Hover
 * alone would be unreachable on a phone and unusable by keyboard, so
 * both are wired: hover to peek, click to pin, Escape or a click
 * outside to close.
 */
export default function ProfileMenu({
  name,
  email,
  avatar,
  signOut,
}: {
  name: string;
  email: string;
  avatar: string | null;
  signOut: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const onProfile = pathname === "/app/profile";

  useEffect(() => {
    if (!open) return;
    function away(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    function key(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", away);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", away);
      document.removeEventListener("keydown", key);
    };
  }, [open]);

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Your account — ${name}`}
        title={name}
        className={
          "grid size-[26px] flex-none place-items-center rounded-full bg-acc " +
          "text-[11px] font-bold text-on-acc transition-shadow hover:ring-2 " +
          "hover:ring-acc-soft " +
          (onProfile ? "ring-2 ring-acc ring-offset-2 ring-offset-surf" : "")
        }
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={avatar}
            alt=""
            width={26}
            height={26}
            className="size-full rounded-full object-cover"
          />
        ) : (
          name.charAt(0).toUpperCase()
        )}
      </button>

      {open && (
        <div
          role="menu"
          /* pt-2 rather than mt-2: the gap has to be part of this element
             or the mouse crosses dead space on the way down and the menu
             closes under the cursor. */
          className="absolute right-0 top-full z-50 pt-2"
        >
          <div className="glass w-[212px] overflow-hidden rounded-[10px]">
            <div className="border-b border-ln px-3 py-2.5">
              <p className="truncate text-[12.5px] font-semibold">{name}</p>
              <p className="truncate text-[11px] text-mut">{email}</p>
            </div>

            <Link
              href="/app/profile"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[12.5px] font-medium transition-colors hover:bg-surf2"
            >
              Settings
            </Link>
            <Link
              href="/app/devices"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-[12.5px] font-medium transition-colors hover:bg-surf2"
            >
              Your devices
            </Link>

            <form action={signOut} className="border-t border-ln">
              <button
                type="submit"
                role="menuitem"
                className="block w-full px-3 py-2 text-left text-[12.5px] font-medium text-mut transition-colors hover:bg-surf2 hover:text-bad"
              >
                Sign out
              </button>
              {/* Named so it is obvious which one goes. "Sign out" alone
                  leaves people wondering about their phone. */}
              <p className="px-3 pb-2 text-[10.5px] text-fai">
                Only this device
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

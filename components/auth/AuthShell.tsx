import type { ReactNode } from "react";

/**
 * Split layout from the auth design: form on the left, a glimpse of the
 * product on the right rather than stock artwork.
 */
export default function AuthShell({
  title,
  subtitle,
  children,
  aside,
}: {
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
  aside: ReactNode;
}) {
  return (
    <main className="grid min-h-screen grid-cols-1 md:grid-cols-[1fr_0.82fr]">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-10">
        <div className="mx-auto w-full max-w-[380px]">
          <div className="mb-7 flex items-center gap-2.5">
            <span className="grid size-7 flex-none place-items-center rounded-lg bg-ink">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--paper)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <path d="M13 2 4 14h7l-1 8 9-12h-7z" />
              </svg>
            </span>
            <span className="font-display text-[15px] font-semibold tracking-[-0.015em]">
              Krama
            </span>
          </div>

          <h1 className="font-display text-[23px] font-semibold leading-[1.15] tracking-[-0.025em]">
            {title}
          </h1>
          {subtitle && <p className="mt-1.5 text-[13px] text-mut">{subtitle}</p>}

          {children}
        </div>
      </div>

      <aside className="hidden flex-col justify-center border-l border-ln bg-surf2 px-7 py-8 md:flex">
        <div className="mx-auto w-full max-w-[320px]">
          {/*
            The name, in the script it comes from. It sits here rather
            than beside the wordmark on the left because at logo size it
            reads as a subtitle — small enough to be filed away as
            chrome and never looked at again. This panel is already the
            one arguing for the product, so the word gets the top of
            that argument at a size where the letterforms are visible,
            and the gloss underneath does the explaining.

            Three screens only: sign in, sign up, forgot. Not the
            header, and not the empty states — a word you meet on every
            screen stops being read by the second week.
          */}
          <p className="font-deva text-[30px] leading-none tracking-[0.02em]">
            <span className="sr-only">Krama, </span>
            <span aria-hidden="true">क्रम</span>
          </p>
          {/* text-mut, not text-fai: the faint token lands at 3.5:1 on
              this panel, and a gloss nobody can read is worse than no
              gloss at all — it is the only thing telling you what the
              name means. */}
          <p className="mt-1.5 text-[11px] tracking-[0.04em] text-mut">
            Krama — <em>step, sequence, order</em>
          </p>
          <div className="my-4 h-px bg-ln" />

          {aside}
        </div>
      </aside>
    </main>
  );
}

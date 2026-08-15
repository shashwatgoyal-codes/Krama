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
        <div className="mx-auto w-full max-w-[320px]">{aside}</div>
      </aside>
    </main>
  );
}

import type { ReactNode } from "react";
import Link from "next/link";

/**
 * The shape every dead end takes: 404, a render that threw, a screen a
 * signed-in person reached by mistyping.
 *
 * Written once because these pages are seen rarely and therefore drift
 * badly — three of them, each styled by whoever wrote it last, is how an
 * app ends up with its most alarming screens looking least like itself.
 *
 * The mark is a step sequence — Krama means step, sequence, order — and
 * a gap in it says "this one is missing" without a broken-robot cartoon.
 * The script itself stays on the sign-in screen and nowhere else, which
 * tests/devanagari.test.ts enforces.
 * It is decorative, so it is hidden from screen readers — the heading
 * already says what happened.
 */
export default function StatusPage({
  code,
  title,
  body,
  actions,
  reference,
  tone = "quiet",
  inShell = false,
}: {
  /** Shown small above the heading. "404", "500", or omitted. */
  code?: string;
  title: string;
  body: ReactNode;
  actions: ReactNode;
  /** The digest, when there is one to quote to whoever runs Krama. */
  reference?: string;
  tone?: "quiet" | "warn";
  /**
   * Rendered inside the app's shell rather than on its own.
   *
   * The nav is still there, so this must not claim the whole viewport or
   * paint its own background — otherwise a wrong turn inside the app
   * looks like being thrown out of it.
   */
  inShell?: boolean;
}) {
  const Wrapper = inShell ? "div" : "main";
  return (
    <Wrapper
      className={
        inShell
          ? "grid min-h-[58vh] place-items-center px-6 py-10"
          : "grid min-h-screen place-items-center bg-paper px-6 py-16"
      }
    >
      <div className="w-full max-w-[440px]">
        <StepMark tone={tone} />

        {code && (
          <p className="mt-7 font-mono text-[11px] tracking-[0.14em] text-fai">
            {code}
          </p>
        )}

        <h1
          className={
            "font-display text-[22px] font-semibold tracking-[-0.02em] text-ink " +
            (code ? "mt-1.5" : "mt-7")
          }
        >
          {title}
        </h1>

        <div className="mt-2.5 max-w-[46ch] text-[12.5px] leading-relaxed text-mut">
          {body}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5 text-[12.5px]">
          {actions}
        </div>

        {reference && (
          <div className="mt-8 border-t border-ln pt-4">
            <p className="text-[11px] leading-relaxed text-fai">
              If you tell whoever runs Krama about this, quote{" "}
              <code className="rounded bg-surf2 px-1 py-0.5 font-mono text-[10.5px] text-mut">
                {reference}
              </code>
              . It is the only thing that ties what you saw to what the server
              recorded.
            </p>
          </div>
        )}
      </div>
    </Wrapper>
  );
}

/**
 * Four steps with the third missing — the sequence interrupted.
 *
 * Drawn rather than lettered so it needs no font, and sized to be noticed
 * without becoming the subject of the page.
 */
function StepMark({ tone }: { tone: "quiet" | "warn" }) {
  const accent = tone === "warn" ? "var(--warn)" : "var(--acc)";
  return (
    <svg
      aria-hidden="true"
      width="88"
      height="34"
      viewBox="0 0 88 34"
      fill="none"
    >
      {[0, 1, 3].map((i) => (
        <rect
          key={i}
          x={i * 23}
          y={26 - i * 7}
          width="14"
          height={i * 7 + 6}
          rx="3"
          fill="var(--ln2)"
        />
      ))}
      {/* The step that isn't there. */}
      <rect
        x={2 * 23}
        y={26 - 2 * 7}
        width="14"
        height={2 * 7 + 6}
        rx="3"
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        strokeDasharray="3 3"
      />
    </svg>
  );
}

/** The two button shapes these pages use, so they match everywhere. */
export function PrimaryLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg bg-ink px-3.5 py-2 font-semibold text-paper transition-opacity hover:opacity-90"
    >
      {children}
    </Link>
  );
}

export function QuietLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-lg border border-ln2 px-3.5 py-2 font-medium text-mut transition-colors hover:border-ink2 hover:text-ink"
    >
      {children}
    </Link>
  );
}

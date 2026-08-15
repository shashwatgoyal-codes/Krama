import Link from "next/link";

/**
 * A section that's designed but not written yet.
 *
 * Says so plainly rather than showing a fake empty state — the nav links
 * here, and a page that pretends to be finished but does nothing is
 * worse than one that admits where it's up to.
 */
export default function NotBuiltYet({
  title,
  what,
  next,
}: {
  title: string;
  what: string;
  next: string;
}) {
  return (
    <div className="mx-auto w-full max-w-[560px] px-5 py-16 text-center">
      <span className="label-xs">Not built yet</span>

      <h1 className="mt-3 font-display text-xl font-semibold tracking-[-0.025em]">
        {title}
      </h1>

      <p className="mx-auto mt-3 max-w-[46ch] text-[13px] leading-relaxed text-mut">
        {what}
      </p>

      <p className="mx-auto mt-4 max-w-[46ch] rounded-lg border border-ln bg-surf2 px-4 py-3 text-[12.5px] leading-relaxed text-mut">
        <span className="font-semibold text-ink">What&rsquo;s next: </span>
        {next}
      </p>

      <Link
        href="/app"
        className="mt-6 inline-flex rounded-[9px] border border-ln2 bg-surf px-3.5 py-2 text-[12.5px] font-semibold text-ink2 transition-colors hover:border-acc hover:text-acc"
      >
        Back to Today
      </Link>
    </div>
  );
}

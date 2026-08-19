import Link from "next/link";

export default function Landing() {
  return (
    <main className="mx-auto max-w-[660px] px-6 py-[clamp(60px,12vh,140px)]">
      <h1 className="font-display text-[clamp(2.2rem,5vw,3.2rem)] font-semibold leading-[1.03] tracking-[-0.035em]">
        One step, then the next.
      </h1>
      <p className="mt-[18px] max-w-[52ch] text-[1.02rem] text-mut">
        Krama holds your tasks, notes, calendar and the things you save — and
        keeps score of the work you actually do, not the results you can&rsquo;t
        control.
      </p>
      <div className="mt-[30px] flex gap-2.5">
        <Link
          href="/app"
          className="inline-flex items-center rounded-[9px] border border-ink bg-ink px-[13px] py-[7px] text-[12.5px] font-semibold text-paper transition-colors hover:bg-ink2 hover:border-ink2"
        >
          Open the app
        </Link>
      </div>
    </main>
  );
}

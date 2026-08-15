/**
 * One panel of the profile page. Flat surfaces with hairline borders
 * rather than floating cards — the same structure the rest of the app
 * uses.
 */
export default function Section({
  title,
  description,
  danger = false,
  children,
}: {
  title: string;
  description?: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={
        "rounded-xl border bg-surf " + (danger ? "border-bad" : "border-ln")
      }
    >
      <header
        className={
          "border-b px-4 py-3 " + (danger ? "border-bad/40" : "border-ln")
        }
      >
        <h2
          className={
            "font-display text-[13.5px] font-semibold tracking-[-0.01em] " +
            (danger ? "text-bad" : "text-ink")
          }
        >
          {title}
        </h2>
        {description && (
          <p className="mt-1 max-w-[62ch] text-[11.5px] leading-relaxed text-mut">
            {description}
          </p>
        )}
      </header>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

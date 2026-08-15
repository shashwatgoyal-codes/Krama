import Link from "next/link";

export default function Landing() {
  return (
    <main className="land">
      <h1>One step, then the next.</h1>
      <p>
        Krama holds your tasks, notes, calendar and the things you save — and
        keeps score of the work you actually do, not the results you can&rsquo;t
        control.
      </p>
      <div className="cta">
        <Link className="btn pri" href="/app">
          Open the app
        </Link>
      </div>
    </main>
  );
}

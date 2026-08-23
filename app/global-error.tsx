"use client";

/**
 * The last resort: an error thrown by the root layout itself, which
 * app/error.tsx cannot catch because it renders inside that layout.
 *
 * It must supply its own <html> and <body> — nothing above it is
 * running — and it therefore cannot use the app's theme tokens, since
 * globals.css is loaded by the layout that just failed. Hence the inline
 * styles: this file has to work when everything else does not, and a
 * page that depends on the thing that broke is not a fallback.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "0 24px",
          background: "#f6f7f9",
          color: "#0f1115",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
        }}
      >
        <div style={{ maxWidth: 400, textAlign: "center" }}>
          <h1 style={{ fontSize: 19, fontWeight: 600, margin: 0 }}>
            Krama couldn&rsquo;t start
          </h1>
          <p
            style={{
              fontSize: 12.5,
              lineHeight: 1.6,
              color: "#5e636d",
              marginTop: 8,
            }}
          >
            Something failed before the page could load. Your data is
            untouched.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 24,
              border: 0,
              borderRadius: 6,
              padding: "7px 13px",
              fontSize: 12.5,
              fontWeight: 600,
              color: "#f6f7f9",
              background: "#0f1115",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 24, fontSize: 10.5, color: "#979ca6" }}>
              Reference {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}

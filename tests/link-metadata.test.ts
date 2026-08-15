import { describe, it, expect } from "vitest";
import { parseMetadata } from "@/lib/links/fetch";

const AT = new URL("https://example.com/posts/staff-archetypes");

describe("parseMetadata", () => {
  it("prefers Open Graph tags", () => {
    const meta = parseMetadata(
      `<html><head>
         <title>Fallback title</title>
         <meta property="og:title" content="The staff engineer archetypes">
         <meta property="og:description" content="Four shapes a staff role can take.">
         <meta property="og:image" content="https://cdn.example.com/cover.png">
       </head></html>`,
      AT,
    );

    expect(meta.title).toBe("The staff engineer archetypes");
    expect(meta.description).toBe("Four shapes a staff role can take.");
    expect(meta.imageUrl).toBe("https://cdn.example.com/cover.png");
  });

  it("falls back to <title> when there is no og:title", () => {
    const meta = parseMetadata(
      "<html><head><title>Postgres index internals</title></head></html>",
      AT,
    );
    expect(meta.title).toBe("Postgres index internals");
  });

  it("reads attributes written in the other order", () => {
    // Plenty of sites emit content before property.
    const meta = parseMetadata(
      `<meta content="Backwards but valid" property="og:title">`,
      AT,
    );
    expect(meta.title).toBe("Backwards but valid");
  });

  it("falls back to twitter: tags", () => {
    const meta = parseMetadata(
      `<meta name="twitter:title" content="From Twitter card">`,
      AT,
    );
    expect(meta.title).toBe("From Twitter card");
  });

  it("returns nulls rather than throwing on a page with no metadata", () => {
    const meta = parseMetadata("<html><body>hello</body></html>", AT);
    expect(meta.title).toBeNull();
    expect(meta.description).toBeNull();
    expect(meta.imageUrl).toBeNull();
  });

  it("decodes the entities a real page contains", () => {
    const meta = parseMetadata(
      `<meta property="og:title" content="Tips &amp; tricks for &quot;deep work&quot;">`,
      AT,
    );
    expect(meta.title).toBe('Tips & tricks for "deep work"');
  });

  it("resolves a relative image against the page URL", () => {
    const meta = parseMetadata(
      `<meta property="og:image" content="/img/cover.png">`,
      AT,
    );
    expect(meta.imageUrl).toBe("https://example.com/img/cover.png");
  });

  it("refuses an image pointing somewhere private", () => {
    // The browser would be the one fetching this, from inside the
    // user's own network — so it gets the same check as the page.
    for (const src of [
      "http://127.0.0.1/secret.png",
      "http://169.254.169.254/token",
      "file:///etc/passwd",
    ]) {
      const meta = parseMetadata(
        `<meta property="og:image" content="${src}">`,
        AT,
      );
      expect(meta.imageUrl, src).toBeNull();
    }
  });

  it("strips www from the source, which is what the list shows", () => {
    const meta = parseMetadata("", new URL("https://www.linkedin.com/posts/1"));
    expect(meta.source).toBe("linkedin.com");
  });

  it("caps a runaway title rather than storing all of it", () => {
    const meta = parseMetadata(
      `<meta property="og:title" content="${"x".repeat(5000)}">`,
      AT,
    );
    expect(meta.title!.length).toBeLessThanOrEqual(400);
  });
});

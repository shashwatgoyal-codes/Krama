import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/**
 * Sending mail through Resend.
 *
 * Written against the HTTP API directly rather than the SDK — one POST
 * with a JSON body is not worth a dependency, and it keeps the CI build
 * free of anything that needs credentials to install.
 *
 * With no API key configured, mail is written to .mail/ instead of being
 * sent. That is what makes the reset flow testable end to end before a
 * domain is verified: the code image lands on disk and can be opened.
 */

export type Attachment = {
  filename: string;
  /** Raw bytes; base64-encoded on the way out. */
  content: Buffer;
  /** Set to reference the file from HTML as <img src="cid:NAME">. */
  contentId?: string;
};

export type Mail = {
  to: string;
  subject: string;
  html: string;
  /**
   * Always supplied explicitly. Left to Resend, the plain-text part is
   * generated from the HTML — which is fine here only because the code
   * isn't in the HTML either.
   */
  text: string;
  attachments?: Attachment[];
};

export type SendResult =
  | { ok: true; id: string; delivered: boolean }
  | { ok: false; error: string };

const ENDPOINT = "https://api.resend.com/emails";

function sender(): string {
  return process.env.EMAIL_FROM ?? "Krama <onboarding@resend.dev>";
}

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendMail(mail: Mail): Promise<SendResult> {
  if (!emailConfigured()) return writeToDisk(mail);

  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender(),
        to: [mail.to],
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: mail.attachments?.map((a) => ({
          filename: a.filename,
          content: a.content.toString("base64"),
          ...(a.contentId ? { content_id: a.contentId } : {}),
        })),
      }),
      // A hanging mail provider must not hang the request that triggered
      // it; the caller reports success regardless, so this just bounds
      // how long it waits before giving up.
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      return { ok: false, error: `Resend responded ${response.status}: ${body.slice(0, 200)}` };
    }

    const data = (await response.json()) as { id?: string };
    return { ok: true, id: data.id ?? "unknown", delivered: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Send failed." };
  }
}

/**
 * The no-API-key path. Writes the HTML and any attachments somewhere a
 * developer can open them, so the flow can be walked without a verified
 * domain.
 */
async function writeToDisk(mail: Mail): Promise<SendResult> {
  const dir = join(process.cwd(), ".mail");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const slug = `${stamp}-${mail.to.replace(/[^a-z0-9]/gi, "_")}`;

  try {
    await mkdir(dir, { recursive: true });

    let html = mail.html;
    for (const attachment of mail.attachments ?? []) {
      const name = `${slug}-${attachment.filename}`;
      await writeFile(join(dir, name), attachment.content);
      // Rewrite cid: references so the saved HTML shows the image when
      // opened straight from the filesystem.
      if (attachment.contentId) {
        html = html.replaceAll(`cid:${attachment.contentId}`, name);
      }
    }

    await writeFile(
      join(dir, `${slug}.html`),
      `<!-- to: ${mail.to}\n     subject: ${mail.subject} -->\n${html}`,
      "utf8",
    );

    console.info(`[email] no RESEND_API_KEY — wrote .mail/${slug}.html`);
    return { ok: true, id: slug, delivered: false };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Write failed." };
  }
}

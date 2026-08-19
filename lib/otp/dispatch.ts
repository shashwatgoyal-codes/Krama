import { renderCodeImage } from "./image";
import type { CodePurpose } from "./code";
import { issueCode, type IssueResult } from "@/lib/repositories/verification";
import { sendMail } from "@/lib/email/send";
import { codeEmail, CODE_IMAGE_CID } from "@/lib/email/templates";

/**
 * Issue a code, draw it, mail it — and never let the plaintext escape
 * this function. It is generated, rendered to a PNG, and dropped; it is
 * not returned, logged, or included in any error.
 */

const FILENAME = "krama-code.png";

export type DispatchResult =
  | { ok: true; delivered: boolean }
  | { ok: false; reason: "cooldown"; retryAfterMs: number }
  | { ok: false; reason: "send_failed" };

export async function sendCode(
  user: { id: string; email: string; name: string },
  purpose: CodePurpose,
): Promise<DispatchResult> {
  const issued: IssueResult = await issueCode(user.id, purpose);
  if (!issued.ok) return { ok: false, reason: "cooldown", retryAfterMs: issued.retryAfterMs };

  const image = renderCodeImage(issued.code);
  const { subject, html, text } = codeEmail({
    purpose,
    name: user.name,
    imageFilename: FILENAME,
  });

  const sent = await sendMail({
    to: user.email,
    subject,
    html,
    text,
    attachments: [
      { filename: FILENAME, content: image, contentId: CODE_IMAGE_CID },
    ],
  });

  if (!sent.ok) {
    // The provider's message can contain the recipient address but never
    // the code, which only ever existed as pixels by this point.
    console.error(`[email] ${purpose} send failed: ${sent.error}`);
    return { ok: false, reason: "send_failed" };
  }

  return { ok: true, delivered: sent.delivered };
}

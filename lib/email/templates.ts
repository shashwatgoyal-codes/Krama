import type { CodePurpose } from "@/lib/otp/code";
import { CODE_TTL_MINUTES } from "@/lib/otp/code";

/**
 * Mail clients are twenty years behind the web, so this is tables and
 * inline styles on purpose. Fixed light colours rather than tokens: an
 * email has no access to the app's stylesheet, and dark-mode handling
 * across clients is inconsistent enough that a self-contained light card
 * is the only thing that reads the same everywhere.
 *
 * The code appears in exactly one place — the attached image. Not in the
 * subject, not in the HTML, not in the text part.
 */

const COPY: Record<
  CodePurpose,
  { subject: string; heading: string; lead: string }
> = {
  password_reset: {
    subject: "Your Krama password reset code",
    heading: "Reset your password",
    lead: "Use the code below to set a new password. It is valid for a short time and can be used once. If you did not request this, no action is needed — the code will expire on its own.",
  },
  email_verify: {
    subject: "Confirm your Krama email address",
    heading: "Confirm your email address",
    lead: "Use the code below to confirm this address. Once confirmed, you will be able to reset your password if you ever need to.",
  },
};

export const CODE_IMAGE_CID = "krama-code";

export function codeEmail(params: {
  purpose: CodePurpose;
  name: string;
  imageFilename: string;
}): { subject: string; html: string; text: string } {
  const copy = COPY[params.purpose];
  const firstName = params.name.split(" ")[0] || "there";

  const html = `<!doctype html>
<html>
<body style="margin:0;padding:0;background:#F4F1EA;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F4F1EA;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E4DED1;border-radius:14px;">
          <tr>
            <td style="padding:28px 28px 0 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 22px 0;font-size:15px;font-weight:700;color:#1C1917;letter-spacing:-0.2px;">Krama</p>
              <h1 style="margin:0 0 12px 0;font-size:19px;font-weight:600;color:#1C1917;letter-spacing:-0.4px;">${copy.heading}</h1>
              <p style="margin:0 0 6px 0;font-size:14px;line-height:1.6;color:#57534E;">Hi ${escapeHtml(firstName)},</p>
              <p style="margin:0 0 22px 0;font-size:14px;line-height:1.6;color:#57534E;">${copy.lead}</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:0 28px;">
              <img src="cid:${CODE_IMAGE_CID}"
                   alt="Your six-digit code, shown as an image"
                   width="374"
                   style="display:block;width:100%;max-width:374px;height:auto;border-radius:10px;" />
            </td>
          </tr>
          <tr>
            <td style="padding:20px 28px 28px 28px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
              <p style="margin:0 0 16px 0;font-size:13px;line-height:1.6;color:#57534E;">
                The code is in the picture above and expires in ${CODE_TTL_MINUTES} minutes.
                It is shown as an image on purpose, so that nothing reading this
                inbox automatically can pick it up.
              </p>
              <p style="margin:0 0 16px 0;font-size:12.5px;line-height:1.6;color:#78716C;">
                Not seeing it? Your mail app may be blocking images — allow
                images for this sender, or open the attachment directly.
              </p>
              <p style="margin:0;padding-top:16px;border-top:1px solid #EFEAE0;font-size:12px;line-height:1.6;color:#A8A29E;">
                Krama will never ask you for this code. Nobody from Krama will
                ever ask you to read it out or forward this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  // Written out rather than generated from the HTML, so there is no path
  // where a stripped-down text part accidentally carries the digits.
  const text = [
    `${copy.heading}`,
    "",
    `Hi ${firstName},`,
    "",
    copy.lead,
    "",
    `Your code is in the attached image (${params.imageFilename}). It expires in ${CODE_TTL_MINUTES} minutes.`,
    "It is sent as an image on purpose, so that nothing reading this inbox automatically can pick it up.",
    "",
    "Krama will never ask you for this code.",
  ].join("\n");

  return { subject: copy.subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

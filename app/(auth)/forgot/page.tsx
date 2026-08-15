import type { Metadata } from "next";
import AuthShell from "@/components/auth/AuthShell";
import ResetFlow from "@/components/auth/ResetFlow";
import { redirectIfSignedIn } from "@/lib/auth/redirect-if-signed-in";

export const metadata: Metadata = {
  title: "Reset your password · Krama",
  robots: { index: false, follow: false },
};

export default async function ForgotPage() {
  await redirectIfSignedIn();

  return (
    <AuthShell
      title="Reset your password"
      subtitle="We'll send a code to your email."
      aside={
        <>
          <p className="font-display text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            The code arrives as a picture.
          </p>
          <p className="mt-2.5 text-[12.5px] leading-relaxed text-mut">
            Not as text you can copy, and not in the subject line. Anything
            reading your inbox automatically — a forwarding rule, a stale
            backup, an assistant with mailbox access — gets an image and
            nothing it can use.
          </p>

          <div className="mt-5 rounded-xl border border-ln bg-surf p-4">
            <p className="label-xs">What the email looks like</p>
            <div className="mt-3 rounded-lg border border-ln2 bg-paper p-3">
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <span
                    key={i}
                    className="h-7 w-[18px] rounded-[3px] bg-ln2"
                    aria-hidden
                  />
                ))}
              </div>
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-mut">
              You read the digits and type them in. It expires in 10 minutes,
              and five wrong guesses burn it.
            </p>
          </div>
        </>
      }
    >
      <ResetFlow />
    </AuthShell>
  );
}

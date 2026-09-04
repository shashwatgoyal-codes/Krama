import type { Metadata } from "next";
import { appName } from "@/lib/env";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: appName(),
  description:
    "A planner that keeps your routines, notes and days in one place — and rewards showing up.",
};

// Applied before first paint so the correct theme is in place immediately.
const themeInit = `
(function(){
  try {
    var t = localStorage.getItem('krama-theme');
    if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // The inline script below stamps data-theme before React hydrates, so
    // the server's <html> and the client's necessarily differ. That's the
    // point — it's what stops a flash of the wrong theme — and it's the
    // one place suppressing the warning is correct rather than lazy.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
          <ToastProvider>{children}</ToastProvider>
        </body>
    </html>
  );
}

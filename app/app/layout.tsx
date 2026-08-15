import type { Metadata } from "next";
import TopBar from "@/components/TopBar";

export const metadata: Metadata = {
  title: "Krama",
  // The app is private — never index it, whatever robots.txt says.
  robots: { index: false, follow: false },
};

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // min-h-screen + flex-col so the two panes below can fill the
    // remaining height rather than collapsing to their content.
    <div className="flex min-h-screen flex-col">
      <TopBar />
      {children}
    </div>
  );
}

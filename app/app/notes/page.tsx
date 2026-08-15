import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/guard";
import { listNotes } from "@/lib/repositories/notes";
import NoteBoard from "@/components/notes/NoteBoard";

export const metadata: Metadata = {
  title: "Notes · Krama",
  robots: { index: false, follow: false },
};

export default async function NotesPage() {
  const user = await requireUser();
  const notes = await listNotes(user.id);

  return <NoteBoard notes={notes} />;
}

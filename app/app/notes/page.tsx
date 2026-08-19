import type { Metadata } from "next";
import { pageTitle } from "@/lib/env";
import { requireUser } from "@/lib/auth/guard";
import { listNotes } from "@/lib/repositories/notes";
import NoteBoard from "@/components/notes/NoteBoard";
import { listTags } from "@/lib/repositories/tags";

export const metadata: Metadata = {
  title: pageTitle("Notes"),
  robots: { index: false, follow: false },
};

export default async function NotesPage() {
  const user = await requireUser();
  const notes = await listNotes(user.id);

  const allTags = await listTags(user.id);

  return <NoteBoard notes={notes} allTags={allTags} />;
}

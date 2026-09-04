import type { SupportScope } from "@prisma/client";

/**
 * Split out from lib/admin/support.ts so a client component can import
 * the labels without dragging the database, and the connection that can
 * read content, into the browser bundle.
 */
export type Scope = SupportScope;

export const SCOPES: Scope[] = ["tasks", "notes", "events", "links"];

export const SCOPE_LABEL: Record<Scope, string> = {
  tasks: "Tasks",
  notes: "Notes",
  events: "Calendar",
  links: "Saved links",
};

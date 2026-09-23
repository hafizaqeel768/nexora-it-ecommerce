// Admin access (server-only). Every admin page, server action and export route checks this itself.
import { notFound, redirect } from "next/navigation";
import { getViewer } from "@/lib/viewer";

/** For pages: signed out → login (back to the page afterwards); signed in without the role → 404. */
export async function requireAdminPage(path: string) {
  const viewer = await getViewer();
  if (!viewer) redirect(`/login?next=${encodeURIComponent(path)}`);
  if (viewer.role !== "ADMIN") notFound();
  return viewer;
}

/** For server actions and route handlers: null unless the caller is an admin. */
export async function getAdmin() {
  const viewer = await getViewer();
  return viewer?.role === "ADMIN" ? viewer : null;
}

export class NotAdminError extends Error {
  constructor() {
    super("Admin access required.");
  }
}

export async function assertAdmin() {
  const admin = await getAdmin();
  if (!admin) throw new NotAdminError();
  return admin;
}

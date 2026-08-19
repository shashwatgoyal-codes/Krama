import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Serves an account's avatar.
 *
 * Public by id rather than session-gated: an avatar is shown next to a
 * name, and gating it would mean the image only loads for its owner.
 * The id is a cuid, so it is not guessable, and nothing else about the
 * account is exposed here.
 *
 * The type comes from what was sniffed at upload, and nosniff stops a
 * browser deciding for itself that these bytes are something more
 * interesting than a picture.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    select: { avatar: true, avatarType: true, avatarAt: true },
  });

  if (!user?.avatar || !user.avatarType) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(user.avatar), {
    headers: {
      "Content-Type": user.avatarType,
      "X-Content-Type-Options": "nosniff",
      // Belt and braces: even if something did decide these bytes were
      // markup, this stops it doing anything with the discovery.
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: `"${user.avatarAt?.getTime() ?? 0}"`,
    },
  });
}

import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { NextResponse } from "next/server";
import { getAuthUserEmail, getAuthUserId } from "@/lib/auth/current-user";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await getAuthUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const email = await getAuthUserEmail(userId);
  const body = (await request.json()) as HandleUploadBody;
  getEnv(); // fail fast if blob token missing

  try {
    const json = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith(`swings/${userId}/`)) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: [
            "video/mp4",
            "video/quicktime",
            "video/webm",
            "video/x-m4v",
          ],
          maximumSizeInBytes: 250 * 1024 * 1024,
          tokenPayload: JSON.stringify({ userId, email }),
        };
      },
      onUploadCompleted: async () => {
        // Persistence happens when the client POSTs /api/swings
      },
    });

    return NextResponse.json(json);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload error";
    console.error("[blob/token]", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

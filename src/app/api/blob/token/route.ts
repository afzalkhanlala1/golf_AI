import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await currentUser();
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
          tokenPayload: JSON.stringify({
            userId,
            email: user?.emailAddresses[0]?.emailAddress ?? "",
          }),
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

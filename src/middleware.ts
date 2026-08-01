import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { isAuthDisabled } from "@/lib/auth-mode";

export default async function middleware(
  req: NextRequest,
  event: NextFetchEvent,
) {
  if (isAuthDisabled()) {
    return NextResponse.next();
  }

  const { clerkMiddleware, createRouteMatcher } = await import(
    "@clerk/nextjs/server"
  );

  const isProtectedRoute = createRouteMatcher([
    "/upload(.*)",
    "/swings(.*)",
    "/progress(.*)",
  ]);

  return clerkMiddleware(async (auth, request) => {
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  })(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|api/health|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/api/((?!health).*)",
  ],
};

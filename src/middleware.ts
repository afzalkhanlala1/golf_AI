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

  const isPublicApi = createRouteMatcher([
    "/api/health(.*)",
    "/api/swings/(.*)/callback",
  ]);
  /**
   * Every room behind the app shell. The shell renders a signed-in identity
   * and its pages read from `/api/*` routes that all require a session, so a
   * route left off this list does not become a public demo — it becomes a
   * page that renders a signed-out sidebar over data it cannot fetch.
   */
  const isProtectedRoute = createRouteMatcher([
    "/upload(.*)",
    "/swings(.*)",
    "/progress(.*)",
    "/lab(.*)",
    "/compare(.*)",
    "/coach(.*)",
    "/fitting(.*)",
    "/settings(.*)",
    "/admin(.*)",
  ]);

  return clerkMiddleware(async (auth, request) => {
    // HMAC-signed Modal callbacks must not require a Clerk session
    if (isPublicApi(request)) {
      return;
    }
    if (isProtectedRoute(request)) {
      await auth.protect();
    }
  })(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|api/health|api/swings/.*/callback|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/api/((?!health|swings/.*/callback).*)",
  ],
};

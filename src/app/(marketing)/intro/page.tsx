import type { Metadata } from "next";
import { IntroLab } from "@/components/intro/intro-lab";

/**
 * Hidden bench for the five launch intros.
 *
 * Reachable only by typing the URL: nothing links here, it is absent from
 * nav-items so it cannot appear in the sidebar or tab bar, and it is outside
 * the protected matcher in middleware.ts, so it does not sit behind a session
 * either. Delete the route once a variant is chosen — the intros themselves
 * live in components/intro and do not depend on it.
 */
export const metadata: Metadata = {
  title: "Intro lab · Grip Intelligence",
  robots: { index: false, follow: false },
};

export default function IntroLabPage() {
  return <IntroLab />;
}

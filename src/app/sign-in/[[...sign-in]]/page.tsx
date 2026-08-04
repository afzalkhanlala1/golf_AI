import { SignIn } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthShell, clerkAppearance } from "@/components/auth-shell";
import { isAuthDisabled } from "@/lib/auth-mode";

export default function SignInPage() {
  // No ClerkProvider is mounted under the dev bypass, so <SignIn> would throw.
  if (isAuthDisabled()) redirect("/upload");

  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Pick up the swing where you left off."
      subtitle="Your score history, fault trends, and drills are waiting — sign in to see what changed since your last session."
    >
      <SignIn appearance={clerkAppearance} />
    </AuthShell>
  );
}

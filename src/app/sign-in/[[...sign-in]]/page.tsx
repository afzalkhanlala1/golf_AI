import { SignIn } from "@clerk/nextjs";
import { AuthShell, clerkAppearance } from "@/components/auth-shell";

export default function SignInPage() {
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

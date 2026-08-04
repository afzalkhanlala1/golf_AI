import { SignUp } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import { AuthShell, clerkAppearance } from "@/components/auth-shell";
import { isAuthDisabled } from "@/lib/auth-mode";

export default function SignUpPage() {
  // No ClerkProvider is mounted under the dev bypass, so <SignUp> would throw.
  if (isAuthDisabled()) redirect("/upload");

  return (
    <AuthShell
      eyebrow="Get started"
      title="Upload your first swing in under two minutes."
      subtitle="No card, no in-browser recording — just a slow-motion clip from your phone and a scored, explained swing on the other side."
    >
      <SignUp appearance={clerkAppearance} />
    </AuthShell>
  );
}

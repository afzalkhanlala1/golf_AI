import { SignUp } from "@clerk/nextjs";
import { AuthShell, clerkAppearance } from "@/components/auth-shell";

export default function SignUpPage() {
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

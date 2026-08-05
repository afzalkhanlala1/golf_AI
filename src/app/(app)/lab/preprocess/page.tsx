import { redirect } from "next/navigation";
import { PreprocessLab } from "@/components/preprocess-lab";
import { requireUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "Clip conditioning · Golf AI",
};

export default async function PreprocessPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <p className="text-sm uppercase tracking-[0.18em] text-[color:var(--ink-muted)]">
        Lab · experimental
      </p>
      <h1 className="mt-2 font-[family-name:var(--font-display)] text-4xl text-[color:var(--fairway)]">
        Clip conditioning
      </h1>
      <p className="mt-3 max-w-2xl text-[color:var(--ink-muted)]">
        Measures a clip&apos;s real resolution and frame rate, then sharpens soft
        footage and fills in intermediate frames by tracking where each block
        of pixels moved between two captured frames.
      </p>
      <p className="mt-3 max-w-2xl rounded-xl border border-[color:var(--sand)]/40 bg-[color:var(--sand-soft)]/50 px-4 py-3 text-sm text-[color:var(--ink)]">
        <strong>What this can and cannot do.</strong> Sharpening makes edges that
        were captured easier for pose to find; it does not add detail that was
        never recorded. Interpolated frames are estimated between real ones — on
        a clubhead moving over 100mph the true path between two captured
        positions is not recoverable, so a smoother-looking 120fps clip built
        from 30fps footage is <em>not</em> a substitute for filming at 120fps.
        Synthetic frames are labelled as such throughout.
      </p>

      <PreprocessLab />
    </main>
  );
}

import { redirect } from "next/navigation";
import { PreprocessLab } from "@/components/preprocess-lab";
import { PageBody, PageHeader } from "@/components/page-header";
import { requireUser } from "@/lib/auth/current-user";

export const metadata = {
  title: "Clip conditioning · Grip Intelligence",
};

export default async function PreprocessPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  return (
    <PageBody>
      <PageHeader
        kicker="The lab · experimental"
        title="Clip conditioning."
        accent="What the camera actually gave us."
        lede="Measures a clip's real resolution and frame rate, then sharpens soft footage and fills in intermediate frames by tracking where each block of pixels moved between two captured frames."
      />

      <div className="animate-rise mt-8 border-l border-[color:var(--warn)] bg-[color:var(--sunk)] px-5 py-4">
        <p className="gi-kicker" style={{ color: "var(--warn)" }}>
          What this can and cannot do
        </p>
        <p className="mt-2.5 max-w-[68ch] text-[12.5px] leading-[1.7] text-[color:var(--muted)]">
          Sharpening makes edges that were captured easier for pose to find; it
          does not add detail that was never recorded. Interpolated frames are
          estimated between real ones — on a clubhead moving over 100mph the
          true path between two captured positions is not recoverable, so a
          smoother-looking 120fps clip built from 30fps footage is{" "}
          <em>not</em> a substitute for filming at 120fps. Synthetic frames are
          labelled as such throughout.
        </p>
      </div>

      <div className="mt-9">
        <PreprocessLab />
      </div>
    </PageBody>
  );
}

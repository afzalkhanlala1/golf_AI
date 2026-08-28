import { redirect } from "next/navigation";
import { PageBody, PageHeader } from "@/components/page-header";
import { ReviewLabelForm } from "@/components/review-label-form";
import { loadInviteById, loadSubmissionForInvite } from "@/lib/review/board";
import { sampleVideoUrl, CoachReviewLabels } from "@/lib/review/labels";
import { getReviewInviteId } from "@/lib/review/session";

export const metadata = {
  title: "Sample · Coach review",
};

export const dynamic = "force-dynamic";

export default async function ReviewSamplePage() {
  const inviteId = await getReviewInviteId();
  if (!inviteId) redirect("/review");

  const invite = await loadInviteById(inviteId);
  if (!invite) redirect("/review");

  const existing = await loadSubmissionForInvite(invite.id);
  const parsed = existing
    ? CoachReviewLabels.safeParse({
        overallScore: existing.overallScore,
        primaryFault: existing.primaryFault,
        faults: existing.faults,
        notes: existing.notes,
      })
    : null;
  const initial = parsed?.success ? parsed.data : null;

  const videoUrl = sampleVideoUrl();

  return (
    <PageBody>
      <PageHeader
        kicker="The sample"
        title="Label this swing the way you would on the lesson tee."
        accent={existing ? "You can update what you already sent." : "One clip. Your labels."}
        lede="Play the sample through, then mark the TPI faults you see, the score you would give, and the first thing you would tell this golfer. This is our review clip, not a customer's video."
      />

      <div className="mt-9 overflow-hidden border border-[color:var(--rule)] bg-[color:var(--sunk)]">
        {videoUrl ? (
          <video
            src={videoUrl}
            controls
            playsInline
            className="aspect-video w-full bg-black"
          />
        ) : (
          <p className="px-6 py-16 text-center text-[13.5px] leading-[1.7] text-[color:var(--muted)]">
            The sample clip URL is not set yet. Ask whoever sent you the code
            to set COACH_REVIEW_SAMPLE_URL, then refresh.
          </p>
        )}
      </div>

      <ReviewLabelForm coachName={invite.name} initial={initial} />
    </PageBody>
  );
}

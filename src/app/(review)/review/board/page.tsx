import { PageBody, PageHeader, Stat } from "@/components/page-header";
import { ReviewBoardLogin } from "@/components/review-board-login";
import { ReviewBoardLists } from "@/components/review-board-lists";
import { ReviewInviteForm } from "@/components/review-invite-form";
import { loadCoachReviewBoard } from "@/lib/review/board";
import {
  boardSecretConfigured,
  isBoardUnlocked,
} from "@/lib/review/session";

export const metadata = {
  title: "Board · Coach review",
};

export const dynamic = "force-dynamic";

export default async function ReviewBoardPage() {
  const unlocked = await isBoardUnlocked();

  if (!unlocked) {
    return (
      <PageBody>
        <PageHeader
          kicker="Coach review"
          title="The board is locked."
          accent={
            boardSecretConfigured()
              ? "Enter the board password."
              : "Set COACH_REVIEW_SECRET, then come back."
          }
          lede="This list is the coaches you invited, not golfers from the app. A Play Store account never appears here."
        />
        {boardSecretConfigured() ? <ReviewBoardLogin /> : null}
      </PageBody>
    );
  }

  const rows = await loadCoachReviewBoard();
  const submitted = rows.filter((row) => row.submitted).length;
  const outstanding = rows.length - submitted;

  return (
    <PageBody wide>
      <PageHeader
        kicker="Coach review"
        title={
          rows.length === 0
            ? "No coaches invited yet."
            : `${submitted} of ${rows.length} labelled the sample.`
        }
        accent={`${outstanding} still outstanding.`}
        lede="Each row is a coach you issued an access code to. They labelled our sample clip — not a golfer's upload. Issue a code, send them /review, and read how they scored the swing."
      />

      <div className="mt-10 grid gap-10 border-t border-[color:var(--rule)] pt-8 sm:grid-cols-3">
        <Stat label="Invited" value={rows.length} note="Access codes you issued." />
        <Stat
          label="Submitted"
          value={submitted}
          tone="green"
          note="Coaches who labelled the sample."
        />
        <Stat
          label="Not yet"
          value={outstanding}
          tone="muted"
          note="Codes that have not been used to submit."
        />
      </div>

      <ReviewInviteForm />
      <ReviewBoardLists rows={rows} />
    </PageBody>
  );
}

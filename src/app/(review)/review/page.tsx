import { PageBody, PageHeader } from "@/components/page-header";
import { ReviewUnlockForm } from "@/components/review-unlock-form";

export const metadata = {
  title: "Coach review · Grip Intelligence",
};

export default function ReviewUnlockPage() {
  return (
    <PageBody>
      <PageHeader
        kicker="Coach review"
        title="Watch the sample. Label what you see."
        accent="Access code required."
        lede="This is a closed review of one sample clip we host — not a golfer's uploaded swing, and not an app account. Enter the access code you were sent."
      />
      <ReviewUnlockForm />
    </PageBody>
  );
}

import { LiveCoach } from "@/components/live-coach";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Live Coach · Grip Intelligence",
};

export default function CoachPage() {
  return (
    <PageBody>
      <PageHeader
        kicker="Live Coach · your camera"
        title="Setup coaching, before you swing."
        accent="Nothing leaves the browser."
        lede="Posture, knee flex, stance width and balance, read from your camera and called out as you stand to the ball. The video is never uploaded and never recorded — the pose runs on your own machine."
      />
      <div className="mt-9">
        <LiveCoach />
      </div>
    </PageBody>
  );
}

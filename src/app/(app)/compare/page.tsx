import { CompareDraw } from "@/components/compare-draw";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Compare · Grip Intelligence",
};

export default function ComparePage() {
  return (
    <PageBody wide>
      <PageHeader
        kicker="Compare · two swings"
        title="Put two swings on one screen."
        accent="Shape first, then timing."
        lede="Both clips are scaled to the same torso length and lined up on the events they share, so you are comparing the swing rather than the height of the golfer or the length of the clip. Draw on either frame."
      />
      <div className="mt-9">
        <CompareDraw />
      </div>
    </PageBody>
  );
}

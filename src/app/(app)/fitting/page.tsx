import { FittingView } from "@/components/fitting-view";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Fitting · Grip Intelligence",
};

export default function FittingPage() {
  return (
    <PageBody>
      <PageHeader
        kicker="Equipment fitting"
        title="Clubs built from your numbers."
        accent="Each one labelled with its source."
        lede="Shaft flex, driver loft, club length, iron head and ball — every recommendation is derived from a swing we measured and a measurement you gave us, and says which. Nothing here is a guess dressed up as a fitting."
      />
      <div className="mt-9">
        <FittingView />
      </div>
    </PageBody>
  );
}

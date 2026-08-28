import Link from "next/link";
import { PageBody, PageHeader } from "@/components/page-header";

export const metadata = {
  title: "Thanks · Coach review",
};

export default function ReviewThanksPage() {
  return (
    <PageBody>
      <PageHeader
        kicker="Coach review"
        title="That's in."
        accent="You can come back with the same code to change it."
        lede="Your labels on the sample are saved against your access code. Nothing else was uploaded — no account, no personal swing."
      />
      <Link
        href="/review/sample"
        className="mt-8 inline-block text-[13px] tracking-[0.04em] text-[color:var(--green)] uppercase"
      >
        Review the sample again
      </Link>
    </PageBody>
  );
}

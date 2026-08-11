import { SwingResult } from "@/components/swing-result";
import { PageBody } from "@/components/page-header";

type Props = { params: Promise<{ id: string }> };

export const metadata = {
  title: "Swing · Grip Intelligence",
};

export default async function SwingDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <PageBody wide>
      <SwingResult id={id} />
    </PageBody>
  );
}

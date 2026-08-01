import { SwingResult } from "@/components/swing-result";

type Props = { params: Promise<{ id: string }> };

export default async function SwingDetailPage({ params }: Props) {
  const { id } = await params;
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <SwingResult id={id} />
    </main>
  );
}

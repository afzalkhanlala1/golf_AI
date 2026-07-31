type SwingDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function SwingDetailPage({ params }: SwingDetailPageProps) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Swing</h1>
      <p className="mt-2 text-muted-foreground">
        Results UI for <code>{id}</code> arrives in Phase B.
      </p>
    </main>
  );
}

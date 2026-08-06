import { FittingView } from "@/components/fitting-view";

export const metadata = {
  title: "Equipment fitting · Golf AI",
};

export default function FittingPage() {
  return (
    <main className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
      <FittingView />
    </main>
  );
}

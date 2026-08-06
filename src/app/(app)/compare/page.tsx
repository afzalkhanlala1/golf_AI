import { CompareDraw } from "@/components/compare-draw";

export const metadata = {
  title: "Compare & Draw · Golf AI",
};

export default function ComparePage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <CompareDraw />
    </main>
  );
}

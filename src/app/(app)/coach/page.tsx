import { LiveCoach } from "@/components/live-coach";

export const metadata = {
  title: "Live Coach · Golf AI",
};

export default function CoachPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <LiveCoach />
    </main>
  );
}

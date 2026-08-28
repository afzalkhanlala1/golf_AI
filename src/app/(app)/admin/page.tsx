import { redirect } from "next/navigation";
import { PageBody, PageHeader, Stat } from "@/components/page-header";
import { SubmitterList } from "@/components/admin-submissions";
import { isCurrentUserAdmin } from "@/lib/auth/admin";
import { requireUser } from "@/lib/auth/current-user";
import { loadSubmissionsLedger } from "@/lib/admin/submissions";

export const metadata = {
  title: "Admin · Grip Intelligence",
};

export const dynamic = "force-dynamic";

const WORDS = [
  "No",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
];

function countWord(n: number): string {
  return n < WORDS.length ? WORDS[n] : String(n);
}

export default async function AdminPage() {
  const userId = await requireUser();
  if (!userId) redirect("/sign-in");

  if (!(await isCurrentUserAdmin())) {
    return (
      <PageBody>
        <PageHeader
          kicker="Admin"
          title="This room is restricted."
          accent="Your account is not on the admin list."
          lede="Only emails listed in ADMIN_EMAILS can open the submissions ledger."
        />
      </PageBody>
    );
  }

  const ledger = await loadSubmissionsLedger();
  const people = ledger.uploads.length;
  const clips = ledger.uploads.reduce((n, p) => n + p.swingCount, 0);
  const demoPeople = ledger.demos.length;
  const demoClips = ledger.demos.reduce((n, p) => n + p.swingCount, 0);

  return (
    <PageBody wide>
      <PageHeader
        kicker="The books"
        title={
          people === 0
            ? "Nobody has submitted their own video yet."
            : `${countWord(people)} ${people === 1 ? "person" : "people"} submitted a real clip.`
        }
        accent="Canned demo clicks are listed separately, below."
        lede="This is everyone who sent their own swing through the pipeline — email, how many clips, and a link to each video. The in-app demo buttons use a placeholder clip and do not count as a submission."
      />

      <div className="mt-10 grid gap-10 border-t border-[color:var(--rule)] pt-8 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="People with a clip"
          value={people}
          note="Distinct accounts that uploaded their own video."
        />
        <Stat
          label="Own videos"
          value={clips}
          note="Clips tagged as uploads, not canned demos."
        />
        <Stat
          label="Demo clickers"
          value={demoPeople}
          tone="muted"
          note="Accounts that ran a Try a demo button."
        />
        <Stat
          label="Canned runs"
          value={demoClips}
          tone="muted"
          note="Placeholder-video analyses from those buttons."
        />
      </div>

      <SubmitterList
        title="Own videos"
        note={`${clips} ${clips === 1 ? "clip" : "clips"}`}
        people={ledger.uploads}
        empty="No one has uploaded their own swing yet. Canned demo runs are listed below so they are not mistaken for submissions."
      />

      <SubmitterList
        title="Canned demo runs"
        note={`${demoClips} ${demoClips === 1 ? "run" : "runs"}`}
        people={ledger.demos}
        empty="Nobody has clicked a Try a demo button yet."
      />
    </PageBody>
  );
}

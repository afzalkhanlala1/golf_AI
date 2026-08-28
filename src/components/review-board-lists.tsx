"use client";

import { useRouter } from "next/navigation";
import { formatDateTime } from "@/lib/format/date";
import { faultLabel } from "@/lib/review/labels";
import type { CoachReviewRow } from "@/lib/review/board";
import { SectionHead } from "@/components/page-header";

function FaultList({ codes }: { codes: string[] }) {
  if (codes.length === 0) {
    return <span className="text-[color:var(--faint)]">None marked</span>;
  }
  return (
    <span>
      {codes.map((code, i) => (
        <span key={code}>
          {i > 0 ? ", " : ""}
          {faultLabel(code)}
        </span>
      ))}
    </span>
  );
}

function Outstanding({
  people,
}: {
  people: CoachReviewRow[];
}) {
  const router = useRouter();

  async function removeInvite(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the invite list?`)) return;
    const res = await fetch(`/api/review/invites?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  if (people.length === 0) {
    return (
      <p className="mt-6 border border-dashed border-[color:var(--rule-strong)] px-6 py-10 text-center text-[13.5px] text-[color:var(--muted)]">
        Everyone who has a code has labelled the sample.
      </p>
    );
  }

  return (
    <div className="mt-2 border-t border-[color:var(--rule-strong)]">
      {people.map((person) => (
        <div
          key={person.inviteId}
          className="gi-row flex flex-wrap items-baseline gap-x-4 gap-y-1 py-4"
        >
          <span className="text-[15px] font-medium">{person.name}</span>
          <span className="font-mono text-[11px] text-[color:var(--faint)]">
            code ends {person.codeHint}
          </span>
          <span className="text-[12px] text-[color:var(--muted)]">
            invited {formatDateTime(person.invitedAt)}
          </span>
          <button
            type="button"
            onClick={() => removeInvite(person.inviteId, person.name)}
            className="ml-auto cursor-pointer text-[11.5px] tracking-[0.08em] text-[color:var(--faint)] uppercase hover:text-[color:var(--bad)]"
          >
            Remove
          </button>
        </div>
      ))}
    </div>
  );
}

function Submitted({ people }: { people: CoachReviewRow[] }) {
  if (people.length === 0) {
    return (
      <p className="mt-6 border border-dashed border-[color:var(--rule-strong)] px-6 py-10 text-center text-[13.5px] text-[color:var(--muted)]">
        No coach has labelled the sample yet.
      </p>
    );
  }

  return (
    <div className="mt-2 border-t border-[color:var(--rule-strong)]">
      {people.map((person) => (
        <article key={person.inviteId} className="border-b border-[color:var(--rule)] py-5">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h3 className="text-[15px] font-semibold">{person.name}</h3>
            <span className="font-mono text-[11px] text-[color:var(--faint)]">
              code ends {person.codeHint}
            </span>
            <span className="ml-auto text-[12px] text-[color:var(--muted)]">
              {person.submittedAt ? formatDateTime(person.submittedAt) : ""}
            </span>
          </div>
          <dl className="mt-3 grid gap-3 text-[13.5px] sm:grid-cols-3">
            <div>
              <dt className="gi-kicker">Score</dt>
              <dd className="mt-1 gi-figure text-[28px]">{person.overallScore}</dd>
            </div>
            <div>
              <dt className="gi-kicker">Primary fault</dt>
              <dd className="mt-1 capitalize">
                {person.primaryFault === "none"
                  ? "None / clean"
                  : faultLabel(person.primaryFault ?? "")}
              </dd>
            </div>
            <div>
              <dt className="gi-kicker">All faults marked</dt>
              <dd className="mt-1">
                <FaultList codes={person.faults} />
              </dd>
            </div>
          </dl>
          {person.notes ? (
            <p className="mt-3 max-w-[62ch] text-[13.5px] leading-[1.7] text-[color:var(--muted)]">
              {person.notes}
            </p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

export function ReviewBoardLists({ rows }: { rows: CoachReviewRow[] }) {
  const submitted = rows.filter((row) => row.submitted);
  const outstanding = rows.filter((row) => !row.submitted);

  return (
    <>
      <section className="mt-12">
        <SectionHead
          title="Submitted"
          note={`${submitted.length} ${submitted.length === 1 ? "review" : "reviews"}`}
        />
        <Submitted people={submitted} />
      </section>
      <section className="mt-12">
        <SectionHead
          title="Not yet"
          note={`${outstanding.length} outstanding`}
        />
        <Outstanding people={outstanding} />
      </section>
    </>
  );
}

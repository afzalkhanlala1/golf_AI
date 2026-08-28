import Link from "next/link";
import { formatDateTime } from "@/lib/format/date";
import { SectionHead } from "@/components/page-header";
import type { Submitter } from "@/lib/admin/submissions";

const STATUS_TONE: Record<string, string> = {
  COMPLETE: "var(--green)",
  QUEUED: "var(--faint)",
  PROCESSING: "var(--faint)",
  FAILED: "var(--bad)",
  REJECTED: "var(--bad)",
};

function viewLabel(view: string): string {
  return view.replaceAll("_", " ");
}

function clubLabel(club: string | null): string {
  return (club ?? "swing").replaceAll("-", " ");
}

function PersonBlock({ person }: { person: Submitter }) {
  return (
    <article className="border-b border-[color:var(--rule)] py-5">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h3 className="min-w-0 truncate text-[15px] font-semibold tracking-[0.01em]">
          {person.email}
        </h3>
        <span className="font-mono text-[11px] text-[color:var(--faint)]">
          {person.userId}
        </span>
        <span className="ml-auto text-[12px] tabular-nums text-[color:var(--muted)]">
          {person.swingCount} {person.swingCount === 1 ? "clip" : "clips"}
        </span>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Recorded", "Club · view", "Status", ""].map((heading) => (
                <th
                  key={heading || "actions"}
                  className="border-b border-[color:var(--rule)] py-2 pr-3 text-left text-[9.5px] font-medium tracking-[0.16em] text-[color:var(--faint)] uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {person.swings.map((swing) => (
              <tr key={swing.id}>
                <td className="py-2.5 pr-3 text-[13px] whitespace-nowrap">
                  <Link
                    href={`/swings/${swing.id}`}
                    className="transition hover:text-[color:var(--green)]"
                  >
                    {formatDateTime(swing.createdAt)}
                  </Link>
                </td>
                <td className="py-2.5 pr-3 text-[12.5px] capitalize text-[color:var(--muted)]">
                  {clubLabel(swing.club)} · {viewLabel(swing.view)}
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className="text-[10px] tracking-[0.12em] uppercase"
                    style={{
                      color: STATUS_TONE[swing.status] ?? "var(--faint)",
                    }}
                  >
                    {swing.status.toLowerCase()}
                  </span>
                </td>
                <td className="py-2.5 text-right whitespace-nowrap">
                  <Link
                    href={`/swings/${swing.id}`}
                    className="text-[11.5px] tracking-[0.08em] text-[color:var(--muted)] uppercase transition hover:text-[color:var(--green)]"
                  >
                    Open
                  </Link>
                  <a
                    href={swing.blobUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="ml-4 text-[11.5px] tracking-[0.08em] text-[color:var(--faint)] uppercase transition hover:text-[color:var(--green)]"
                  >
                    Video
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function SubmitterList({
  title,
  note,
  people,
  empty,
}: {
  title: string;
  note: string;
  people: Submitter[];
  empty: string;
}) {
  return (
    <section className="mt-12">
      <SectionHead title={title} note={note} />
      {people.length === 0 ? (
        <p className="mt-6 border border-dashed border-[color:var(--rule-strong)] px-6 py-12 text-center text-[13.5px] leading-[1.7] text-[color:var(--muted)]">
          {empty}
        </p>
      ) : (
        <div className="mt-2 border-t border-[color:var(--rule-strong)]">
          {people.map((person) => (
            <PersonBlock key={person.userId} person={person} />
          ))}
        </div>
      )}
    </section>
  );
}

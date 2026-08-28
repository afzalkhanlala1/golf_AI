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

function PersonRow({
  person,
  defaultOpen,
}: {
  person: Submitter;
  defaultOpen?: boolean;
}) {
  return (
    <details className="gi-row group" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-baseline gap-4 py-4 pr-2 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-medium">
            {person.email}
          </span>
          <span className="mt-1 block truncate font-mono text-[11px] text-[color:var(--faint)]">
            {person.userId}
          </span>
        </span>
        <span className="hidden shrink-0 text-[12.5px] tabular-nums text-[color:var(--muted)] sm:block">
          {person.swingCount} {person.swingCount === 1 ? "clip" : "clips"}
        </span>
        <span className="hidden shrink-0 text-[12.5px] text-[color:var(--muted)] md:block">
          {formatDateTime(person.latestAt)}
        </span>
        <span
          className="shrink-0 text-[10px] tracking-[0.12em] uppercase"
          style={{ color: STATUS_TONE[person.latestStatus] ?? "var(--faint)" }}
        >
          {person.latestStatus.toLowerCase()}
        </span>
      </summary>

      <div className="overflow-x-auto pb-4 pl-1">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              {["Recorded", "Club · view", "Status", ""].map((h) => (
                <th
                  key={h || "actions"}
                  className="border-b border-[color:var(--rule)] py-2 pr-3 text-left text-[9.5px] font-medium tracking-[0.16em] text-[color:var(--faint)] uppercase"
                >
                  {h}
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
    </details>
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
          {people.map((person, index) => (
            <PersonRow
              key={person.userId}
              person={person}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      )}
    </section>
  );
}

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { QUERIES } from "./content";
import { MONO, SqlText } from "./Code";
import { Surface, TD, TH } from "./Section";

/** Demo actions next to the one-hop query that answers each, with a link to the same state in the demo. */
export function QueryTable() {
  return (
    <Surface className="overflow-x-auto">
      <table className="w-full min-w-[820px] border-collapse">
        <caption className="sr-only">Each demo action and the one-hop query that answers it</caption>
        <thead>
          <tr className="border-b border-line">
            <th scope="col" className={cx(TH, "w-[28%] pl-6")}>
              Demo action
            </th>
            <th scope="col" className={TH}>
              Query
            </th>
            <th scope="col" className={cx(TH, "w-[200px] pr-6")}>
              See it in the demo
            </th>
          </tr>
        </thead>
        <tbody>
          {QUERIES.map((q) => (
            <tr key={q.action} className="border-b border-line last:border-b-0">
              <td className={cx(TD, "pl-6 font-medium text-fg-1")}>{q.action}</td>
              <td className={cx(TD, "py-3")}>
                <code className={cx(MONO, "block rounded-card border border-line bg-surface-2 px-3 py-2")}>
                  <SqlText code={q.query} />
                </code>
              </td>
              <td className={cx(TD, "pr-6")}>
                <Link
                  href={q.href}
                  target="_blank"
                  rel="noopener"
                  className="group inline-flex items-center gap-1.5 rounded-button text-[13px] leading-5 font-medium text-teal-bright transition-colors duration-[120ms] hover:text-fg-1"
                >
                  {q.linkLabel}
                  <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
                  <span className="sr-only">(opens the demo in a new tab)</span>
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Surface>
  );
}

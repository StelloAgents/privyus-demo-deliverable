import { RefreshCw } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { STORES } from "./content";
import { Surface, TD, TH } from "./Section";

/** The stores table (layer 3) and how the data stays current. */
export function StoresAndRelease() {
  return (
    <div className="flex flex-col gap-10">
      <div className="flex flex-col gap-3">
        <Surface className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse">
            <caption className="sr-only">The stores, what each holds, and the questions each answers</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={cx(TH, "w-[22%] pl-6")}>
                  Store
                </th>
                <th scope="col" className={cx(TH, "w-[28%]")}>
                  Holds
                </th>
                <th scope="col" className={cx(TH, "w-[26%]")}>
                  Answers
                </th>
                <th scope="col" className={cx(TH, "pr-6")}>
                  Example technology
                </th>
              </tr>
            </thead>
            <tbody>
              {STORES.map((s) => (
                <tr key={s.store} className="border-b border-line last:border-b-0">
                  <th scope="row" className={cx(TD, "pl-6 text-left font-medium text-fg-1")}>
                    {s.store}
                  </th>
                  <td className={TD}>{s.holds}</td>
                  <td className={cx(TD, "text-fg-1")}>{s.answers}</td>
                  <td className={cx(TD, "pr-6")}>{s.tech}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
        <p className="t-body text-fg-2">
          Start with one Postgres database, and split out stores as the data grows. A columnar database or Postgres
          answers the one-hop queries behind each click; a graph database becomes necessary only for multi-hop path questions.
        </p>
      </div>

      <Surface className="p-5">
        <RefreshCw size={20} strokeWidth={1.5} className="text-teal" aria-hidden="true" />
        <h4 className="t-card-title mt-4">Incremental Updates</h4>
        <p className="t-body mt-1.5 text-fg-2">
          Each source also runs an incremental update, daily or hourly, that keeps its position with a cursor. This
          feeds the live activity feed and the watchlist alerts.
        </p>
      </Surface>
    </div>
  );
}

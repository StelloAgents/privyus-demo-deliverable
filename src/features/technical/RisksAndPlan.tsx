import { cx } from "@/components/ui/cx";
import { RISKS } from "./content";
import { Surface, TD, TH } from "./Section";

/** Section 7 of the architecture file: the risks and how each is reduced. */
export function Risks() {
  return (
    <div className="flex flex-col gap-3">
      <Surface className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse">
          <caption className="sr-only">Risks, why each matters, and how to reduce it</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={cx(TH, "w-[24%] pl-6")}>
                Risk
              </th>
              <th scope="col" className={cx(TH, "w-[30%]")}>
                Why it matters
              </th>
              <th scope="col" className={cx(TH, "pr-6")}>
                How to reduce it
              </th>
            </tr>
          </thead>
          <tbody>
            {RISKS.map((r) => (
              <tr key={r.risk} className="border-b border-line last:border-b-0">
                <th scope="row" className={cx(TD, "pl-6 text-left font-medium text-fg-1")}>
                  {r.risk}
                </th>
                <td className={TD}>{r.why}</td>
                <td className={cx(TD, "pr-6 text-fg-1")}>{r.reduce}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>
    </div>
  );
}

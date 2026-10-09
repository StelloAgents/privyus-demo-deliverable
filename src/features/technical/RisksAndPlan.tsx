import { cx } from "@/components/ui/cx";
import { PHASES, RISKS, type Phase } from "./content";
import { Note, Surface, TD, TH } from "./Section";

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

const TOTAL_SPAN = PHASES.reduce((n, p) => n + p.span, 0);
const STARTS = PHASES.map((_, i) => PHASES.slice(0, i).reduce((n, p) => n + p.span, 0));

/** Section 8: the phased plan, with a relative track (lengths are indicative, not a schedule). */
export function Plan() {
  return (
    <div className="flex flex-col gap-3">
      <Surface className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <caption className="sr-only">Phased plan: scope, team, and time for each phase</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={cx(TH, "w-[19%] pl-6")}>
                Phase
              </th>
              <th scope="col" className={TH}>
                Scope
              </th>
              <th scope="col" className={cx(TH, "w-[16%]")}>
                Team
              </th>
              <th scope="col" className={cx(TH, "w-[22%] pr-6")}>
                Time
              </th>
            </tr>
          </thead>
          <tbody>
            {PHASES.map((p, i) => {
              const start = STARTS[i];
              return (
                <tr key={p.phase} className="border-b border-line last:border-b-0">
                  <th scope="row" className={cx(TD, "pl-6 text-left")}>
                    <span className="t-meta block">Phase {p.phase}</span>
                    <span className="mt-0.5 block font-medium text-fg-1">{p.name}</span>
                  </th>
                  <td className={TD}>{p.scope}</td>
                  <td className={cx(TD, "text-fg-1")}>{p.team}</td>
                  <td className={cx(TD, "pr-6")}>
                    <span className="block text-fg-1">{p.time}</span>
                    <Track phase={p} start={start} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Surface>
      <Note>These are planning estimates for a small senior team. They are not quotes.</Note>
      <p className="t-body mt-3 max-w-[760px] text-fg-2">
        Running cost in phases 1 and 2 is mostly cloud hosting and LLM usage. It grows with users and sources. A design
        partner pilot can run on a modest monthly budget.
      </p>
    </div>
  );
}

/** A thin relative track: where the phase sits in the sequence. Open-ended phases have a dashed end. */
function Track({ phase, start }: { phase: Phase; start: number }) {
  const left = (start / TOTAL_SPAN) * 100;
  const width = (phase.span / TOTAL_SPAN) * 100;
  return (
    <span className="relative mt-2.5 block h-1.5 rounded-[1px] bg-surface-3" aria-hidden="true">
      <span
        className={cx(
          "absolute inset-y-0 rounded-[1px]",
          phase.status === "done" && "bg-teal",
          phase.status === "next" && "bg-teal-bright",
          phase.status === "later" && "border border-teal",
          phase.open && "border-r-0 border-dashed",
        )}
        style={{ left: `${left}%`, width: `${width}%` }}
      />
    </span>
  );
}

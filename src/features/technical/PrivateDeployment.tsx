import { KeyRound, Lock } from "lucide-react";
import { cx } from "@/components/ui/cx";
import { DEPLOY_OPTIONS, DEPLOY_ROWS, KEPT_NOTES } from "./content";
import { PrivateDiagram } from "./PrivateDiagram";
import { Surface, TD, TH } from "./Section";

/** Private deployment (planned): cloud vs. private instance, the data flow, and what stays in Privyus. */
export function PrivateDeployment() {
  return (
    <div className="flex flex-col gap-10">
      <Surface className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse">
          <caption className="sr-only">Privyus Cloud compared with a private Privyus instance</caption>
          <thead>
            <tr className="border-b border-line">
              <th scope="col" className={cx(TH, "w-[22%] pl-6")}>
                <span className="sr-only">Compare</span>
              </th>
              {DEPLOY_OPTIONS.map((o) => (
                <th key={o.id} scope="col" className={cx(TH, "w-[39%] last:pr-6")}>
                  <span className="t-card-title block text-fg-1 normal-case">{o.name}</span>
                  <span className="mt-0.5 block font-normal">{o.sub}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DEPLOY_ROWS.map((r) => (
              <tr key={r.label} className="border-b border-line last:border-b-0">
                <th scope="row" className={cx(TD, "pl-6 text-left font-medium text-fg-1")}>
                  {r.label}
                </th>
                <td className={TD}>{r.cloud}</td>
                <td className={cx(TD, "pr-6 text-fg-1")}>{r.private}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Surface>

      <PrivateDiagram />

      <div className="flex flex-col gap-4">
        <h3 className="font-display text-[18px] leading-6 font-semibold text-fg-1">What Stays Inside Privyus</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {KEPT_NOTES.map((n, i) => {
            const Icon = i === 0 ? Lock : KeyRound;
            return (
              <Surface key={n.title} className="p-5">
                <Icon size={20} strokeWidth={1.5} className="text-teal" aria-hidden="true" />
                <h4 className="t-card-title mt-4">{n.title}</h4>
                <p className="t-body mt-1.5 text-fg-2">{n.body}</p>
              </Surface>
            );
          })}
        </div>
      </div>
    </div>
  );
}

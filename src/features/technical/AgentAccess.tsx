import { cx } from "@/components/ui/cx";
import { MONO } from "./Code";
import { AGENT_TOOLS } from "./content";
import { DoorsDiagram } from "./DoorsDiagram";
import { Surface, TD, TH } from "./Section";

/** Agent access (planned): one core behind three doors, and the tools. */
export function AgentAccess() {
  return (
    <div className="flex flex-col gap-10">
      <DoorsDiagram />

      <div className="flex flex-col gap-4">
        <h3 className="font-display text-[18px] leading-6 font-semibold text-fg-1">MCP Tools</h3>
        <Surface className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">The planned MCP tools and what each returns</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={cx(TH, "w-[220px] pl-6")}>
                  Tool
                </th>
                <th scope="col" className={cx(TH, "pr-6")}>
                  What it returns
                </th>
              </tr>
            </thead>
            <tbody>
              {AGENT_TOOLS.map((t) => (
                <tr key={t.tool} className="border-b border-line last:border-b-0">
                  <th scope="row" className={cx(TD, "pl-6 text-left font-normal")}>
                    <code className={cx(MONO, "font-semibold text-fg-1")}>{t.tool}</code>
                  </th>
                  <td className={cx(TD, "pr-6")}>{t.returns}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>
    </div>
  );
}

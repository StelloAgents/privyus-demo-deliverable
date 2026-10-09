import { cx } from "@/components/ui/cx";
import { AgentSession } from "./AgentSession";
import { MONO } from "./Code";
import { AGENT_TOOLS } from "./content";
import { DoorsDiagram } from "./DoorsDiagram";
import { Surface, TD, TH } from "./Section";

/** Agent access (planned): one core behind three doors, a played agent session, and the tools. */
export function AgentAccess() {
  return (
    <div className="flex flex-col gap-10">
      <DoorsDiagram />

      <div className="flex flex-col gap-4">
        <div className="max-w-[720px]">
          <h3 className="font-display text-[18px] leading-6 font-semibold text-fg-1">Agent Research Session</h3>
          <p className="t-body mt-2 text-fg-2">
            A fund&rsquo;s research agent asks one question and makes five tool calls. Each result adds nodes to the
            same graph that the app draws. The records, dates, and amounts come from the demo data.
          </p>
        </div>
        <AgentSession />
      </div>

      <div className="flex flex-col gap-4">
        <h3 className="font-display text-[18px] leading-6 font-semibold text-fg-1">MCP Tools</h3>
        <Surface className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <caption className="sr-only">The planned MCP tools, what each returns, and where the session above uses it</caption>
            <thead>
              <tr className="border-b border-line">
                <th scope="col" className={cx(TH, "w-[220px] pl-6")}>
                  Tool
                </th>
                <th scope="col" className={TH}>
                  What it returns
                </th>
                <th scope="col" className={cx(TH, "w-[120px] pr-6")}>
                  In the session
                </th>
              </tr>
            </thead>
            <tbody>
              {AGENT_TOOLS.map((t) => (
                <tr key={t.tool} className="border-b border-line last:border-b-0">
                  <th scope="row" className={cx(TD, "pl-6 text-left font-normal")}>
                    <code className={cx(MONO, "font-semibold", t.used ? "text-teal-bright" : "text-fg-1")}>{t.tool}</code>
                  </th>
                  <td className={TD}>{t.returns}</td>
                  <td className={cx(TD, "pr-6 text-fg-3")}>{t.used ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Surface>
      </div>
    </div>
  );
}

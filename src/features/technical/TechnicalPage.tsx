import { AgentAccess } from "./AgentAccess";
import { Crosswalk } from "./Crosswalk";
import { DataModel } from "./DataModel";
import { GraphDrawing } from "./GraphDrawing";
import { QueryTable } from "./QueryTable";
import { Risks } from "./RisksAndPlan";
import { ScaleBand } from "./ScaleBand";
import { Section } from "./Section";
import { StoresAndRelease } from "./StoresAndRelease";
import { SystemDiagram } from "./SystemDiagram";
import { Toc } from "./Toc";

/*
 * The hidden technical architecture page (/technical). Not linked from the app.
 * Content source: technical-architecture.md in the project root.
 */

const FACTS = [
  { label: "Data", value: "Public records", note: "Federal sources first, then the 50 states" },
  { label: "Technology", value: "Available today", note: "Standard databases, connectors, and LLM extraction" },
  { label: "First version", value: "One topic, federal sources", note: "A goal for a small senior team" },
];

export function TechnicalPage() {
  return (
    <div className="mx-auto grid w-full max-w-[1344px] grid-cols-1 gap-12 px-2 pt-8 pb-20 min-[1400px]:grid-cols-[192px_minmax(0,1fr)]">
      <aside className="hidden min-[1400px]:block">
        <Toc />
      </aside>

      <article className="flex w-full max-w-[1080px] min-w-0 flex-col gap-24">
        {/* Summary */}
        <section id="summary" aria-labelledby="summary-title" className="scroll-mt-6">
          <h1 id="summary-title" className="font-display text-[44px] leading-[50px] font-bold tracking-[-0.015em] text-fg-1">
            Technical Architecture
          </h1>
          <p className="mt-5 max-w-[760px] text-[17px] leading-[28px] text-fg-2">
            The hard part of Privyus is the data work under the screens. Records about one person sit in many sources,
            and each one must join a single node with a link to the original record. The demo shows layer 4 (the
            product experience) with fixed and illustrative data. The real product adds three layers under it: collect,
            resolve, and store.
          </p>
          <dl className="mt-10 grid grid-cols-1 border-y border-line md:grid-cols-3">
            {FACTS.map((f, i) => (
              <div key={f.label} className={i > 0 ? "border-t border-line py-5 md:border-t-0 md:border-l md:pl-6" : "py-5 md:pr-6"}>
                <dt className="t-meta">{f.label}</dt>
                <dd className="mt-1.5 font-display text-[20px] leading-[26px] font-semibold text-fg-1">{f.value}</dd>
                <dd className="t-body mt-1 text-fg-2">{f.note}</dd>
              </div>
            ))}
          </dl>
        </section>

        <Section
          id="scale"
          title="Data Volume"
          lead="Federal data alone runs to hundreds of millions of rows, and new filings arrive every day."
        >
          <ScaleBand />
        </Section>

        <Section
          id="system"
          title="Four System Layers"
          lead="Each layer feeds the next one, and each layer can grow on its own. Records move from the public sources on the left to the app on the right. The pipeline keeps three tiers of tables, and only the serving tier is visible to the app."
        >
          <SystemDiagram />
        </Section>

        <Section
          id="resolution"
          kicker="Layer 2 · Resolve and connect"
          title="Entity Resolution"
          lead={
            <>
              Raw records name the same person in many ways. Privyus must turn them into one node. It starts from public
              IDs, uses fuzzy matching and an LLM check where no ID exists, and sends uncertain matches to a person. It
              never guesses silently. Large social networks solve the same problem when they combine many weak signals
              into one confident identity.
            </>
          }
        >
          <Crosswalk />
        </Section>

        <Section
          id="data-model"
          kicker="Layer 3 · Store"
          title="Serving Data Model"
          lead="The product is the connections, so the serving tier stores nodes and edges, not one wide row per person."
        >
          <DataModel />
        </Section>

        <Section
          id="queries"
          kicker="Layer 3 · Store"
          title="One-Hop Queries"
          lead="Each click in the demo maps to a query that reads one sorted range. A columnar database (for example, ClickHouse) or Postgres answers each one in milliseconds. Open a link to see the same click in the demo, next to its query."
        >
          <QueryTable />
        </Section>

        <Section
          id="drawing"
          kicker="Layer 4 · Query and display"
          title="How the Graph Is Drawn"
          lead="The agent returns data in one fixed shape, and the app draws it. The agent never writes free-form queries."
        >
          <GraphDrawing />
        </Section>

        <Section
          id="agents"
          kicker="Layer 4 · Query and display"
          title="Agent Access"
          badge="Planned"
          lead="Privyus can serve AI agents from the same core as the app, through a REST API and an MCP server. Every result carries its sources, so an agent can cite the filing behind each claim. Agents will do a growing share of the research that analysts do today."
        >
          <AgentAccess />
        </Section>

        <Section
          id="stores"
          kicker="Layer 3 · Store"
          title="Stores and Releases"
          lead="Each store answers a different type of question. A release reaches the app only after its checks pass, and it can be rolled back."
        >
          <StoresAndRelease />
        </Section>

        <Section
          id="risks"
          title="Risks and Mitigations"
          lead="Each risk below is a known engineering or process problem, with a known way to reduce it."
        >
          <Risks />
        </Section>

      </article>
    </div>
  );
}

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { DELTA_EXAMPLE, DRAW_STEPS, RECORDS_EXAMPLE } from "./content";
import { CodeBlock, JsonText } from "./Code";
import { Surface } from "./Section";

/** How the graph is drawn: four steps, then the real response shape the demo already plays. */
export function GraphDrawing() {
  return (
    <div className="flex flex-col gap-4">
      <ol className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {DRAW_STEPS.map(({ icon: Icon, title, body }, i) => (
          <li key={title} className="relative">
            <Surface className="h-full p-5">
              <div className="flex items-center justify-between">
                <Icon size={20} strokeWidth={1.5} className="text-teal" aria-hidden="true" />
                {i < DRAW_STEPS.length - 1 ? (
                  <ArrowRight size={16} strokeWidth={1.5} className="hidden text-fg-3 lg:block" aria-hidden="true" />
                ) : null}
              </div>
              <h3 className="t-card-title mt-4">{title}</h3>
              <p className="t-body mt-1.5 text-fg-2">{body}</p>
            </Surface>
          </li>
        ))}
      </ol>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <CodeBlock
          title="Agent Response"
          meta={
            <Link
              href="/explore?turn=hartley-meetings"
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-1 text-teal-bright transition-colors duration-[120ms] hover:text-fg-1"
            >
              Play it in the demo
              <ArrowUpRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </Link>
          }
        >
          <JsonText code={DELTA_EXAMPLE} />
        </CodeBlock>
        <div className="flex min-w-0 flex-col gap-4">
          <CodeBlock title="Referenced Records" meta="entities · edges · documents">
            <JsonText code={RECORDS_EXAMPLE} />
          </CodeBlock>
          <Surface className="flex flex-1 flex-col gap-3 p-5">
            <h3 className="t-card-title">One Shared Shape</h3>
            <p className="t-body text-fg-2">
              Each step completes when its part of the graph appears. The edge carries the id of its source document,
              so the answer can show a source chip. The document carries the two states that the map draws as an arc.
            </p>
            <p className="t-body text-fg-2">
              A real backend returns this same shape, so it can replace the fixed data file without a rebuild of the
              screens.
            </p>
          </Surface>
        </div>
      </div>
    </div>
  );
}

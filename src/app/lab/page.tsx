import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Alternative Designs",
  description: "Three directions for the Privyus graph, side by side.",
  robots: { index: false, follow: false },
};

const DIRECTIONS = [
  {
    slug: "orbit",
    name: "Orbit + Chronos",
    summary:
      "The selected person sits at the center. Each ring is one kind of relationship (meetings, money, votes, trips), and the position around the ring is the date, so records from the same month line up. The timeline at the bottom plays the records in date order.",
    strengths: ["Easiest to read", "Time is built into the layout", "Fits the presenter tour"],
    weaknesses: ["Busy near the highlighted path", "A node with few links looks sparse"],
  },
  {
    slug: "strata",
    name: "Strata",
    summary:
      "A true 3D scene with one layer for each type of record: topics and bills, people, organizations, and money and events. Lines run between the layers, and only the selected path is lit.",
    strengths: ["Strongest sense of depth", "Rich cards on the selected records"],
    weaknesses: ["Labels crowd at the default view", "Reads more as an effect than a tool"],
  },
  {
    slug: "chronos",
    name: "Chronos",
    summary:
      "Records stand above a map of the United States, where they happened. Press play to see meetings and money appear over time, or switch to Time depth so that height shows the date.",
    strengths: ["Most memorable moment", "Place and time in one view"],
    weaknesses: ["Most records sit in Washington, DC", "Labels collide in the busy areas"],
  },
] as const;

/** Graph lab index: links to the three graph direction prototypes. Linked from the top nav as "Alternative Designs". */
export default function GraphLabPage() {
  return (
    <main className="mx-auto w-full max-w-[1320px] px-8 py-10">
      <header className="max-w-[760px]">
        <h1 className="font-display text-[36px] leading-[44px] font-bold text-fg-1">Alternative Designs</h1>
        <p className="t-body mt-3 text-fg-2">
          Three directions for the Explore graph, built on the same demo records around Sen. Ellen Hartley. Each one is a working
          prototype: drag to orbit, scroll to zoom, and click a node to focus it. Open each one, then pick the direction to build
          into the demo.
        </p>
      </header>

      <ol className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {DIRECTIONS.map((d, i) => (
          <li key={d.slug} className="flex flex-col overflow-hidden rounded-panel border border-line bg-surface-1">
            <Link href={`/lab/${d.slug}`} className="group block border-b border-line">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/lab/${d.slug}.jpg`}
                alt={`${d.name} prototype`}
                className="aspect-[16/10] w-full object-cover transition-opacity duration-[120ms] group-hover:opacity-90"
              />
            </Link>
            <div className="flex flex-1 flex-col p-6">
              <span className="t-meta">Option {i + 1}</span>
              <h2 className="mt-1 font-display text-[24px] leading-[30px] font-semibold text-fg-1">{d.name}</h2>
              <p className="t-body mt-3 text-fg-2">{d.summary}</p>
              <dl className="mt-5 grid grid-cols-2 gap-4">
                <div>
                  <dt className="t-meta">Strengths</dt>
                  <dd className="mt-1">
                    <ul className="t-body space-y-1 text-fg-1">
                      {d.strengths.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
                <div>
                  <dt className="t-meta">Weaknesses</dt>
                  <dd className="mt-1">
                    <ul className="t-body space-y-1 text-fg-2">
                      {d.weaknesses.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </dd>
                </div>
              </dl>
              <div className="mt-auto pt-6">
              <Link
                href={`/lab/${d.slug}`}
                className="inline-flex w-fit items-center gap-1.5 rounded-button border border-line px-3.5 pt-[9px] pb-[9px] text-[14px] font-semibold text-fg-1 transition-colors duration-[120ms] hover:bg-surface-2"
              >
                Open {d.name}
                <ArrowUpRight size={15} strokeWidth={1.75} aria-hidden="true" />
              </Link>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </main>
  );
}

"use client";

import { Bookmark, FileText, Plane, Vote } from "lucide-react";
import { useState } from "react";
import {
  AskBar,
  Avatar,
  Button,
  EntityRow,
  IconRing,
  KpiTile,
  LiveChip,
  Panel,
  ReasoningSteps,
  SourceChip,
  SourceDrawer,
  Sparkline,
  useToast,
} from "@/components/ui";
import { fadeRiseStyle } from "@/lib/motion";
import type { SourceDoc } from "@/lib/types";

const SOURCE: SourceDoc = {
  id: "fara-6843",
  kind: "FARA",
  title: "FARA supplemental statement #6843",
  date: "2026-05-02",
  excerpt: "Registrant reports a meeting with the office of Sen. Ellen Hartley on security assistance for Ukraine.",
};

/** Test page for the shared UI primitives (DESIGN.md section 4). */
export function DevUiClient() {
  const toast = useToast();
  const [source, setSource] = useState<SourceDoc | null>(null);
  return (
    <div className="grid grid-cols-3 gap-4">
      <Panel title="KPI tiles" subtitle="Label, figure, delta, sparkline">
        <div className="grid grid-cols-1 gap-3">
          <KpiTile label="Active members" value={1284} delta={37} deltaCaption="this week" series={[8, 9, 9, 11, 10, 12, 13, 12, 14, 15, 15, 17]} />
          <KpiTile label="New activity" value="312" delta="-4.2%" deltaCaption="vs last week" series={[18, 17, 16, 17, 15, 16, 14, 15, 13, 14, 13, 12]} />
          <KpiTile label="Reports generated" value={46} delta={9} series={[2, 3, 3, 4, 3, 5, 6, 5, 7, 6, 8, 9]} />
        </div>
      </Panel>
      <Panel title="Entity rows" subtitle="Chevron on hover only" action={<LiveChip />}>
        <div className="flex flex-col gap-2">
          {[
            { i: "EH", t: "Sen. Ellen Hartley", s: "Voted yes on S. 456", m: "Today" },
            { i: "IM", t: "Sen. Isabel Marquez", s: "Committee hearing", m: "Yesterday" },
          ].map((r, idx) => (
            <EntityRow key={r.t} style={fadeRiseStyle(idx)} leading={<Avatar initials={r.i} />} title={r.t} subtitle={r.s} meta={r.m} onClick={() => {}} />
          ))}
          <EntityRow style={fadeRiseStyle(2)} leading={<IconRing icon={Plane} />} title="Travel filing: Kyiv" subtitle="Sen. Ellen Hartley" meta="Mar 2026" onClick={() => {}} />
          <EntityRow style={fadeRiseStyle(3)} leading={<IconRing icon={FileText} />} title="H.R. 123" subtitle="Ukraine Aid Act" trailing={<Sparkline values={[3, 4, 4, 6, 5, 7, 8, 8, 10, 11, 12, 14]} highlightLast />} onClick={() => {}} />
          <EntityRow style={fadeRiseStyle(4)} variant="plain" leading={<IconRing icon={Vote} />} title="Roll call vote 214" subtitle="Plain variant, not clickable" meta="Sep 18" />
        </div>
      </Panel>
      <Panel title="Chat parts" subtitle="Ask bar, steps, sources">
        <div className="flex flex-col gap-5">
          <ReasoningSteps
            complete={false}
            thoughtSeconds={3}
            steps={[
              { label: "Set root node", status: "done" },
              { label: "Query the database", status: "done" },
              { label: "Populate categories", status: "active" },
              { label: "Establish connections", status: "pending" },
              { label: "Render", status: "pending" },
            ]}
          />
          <ReasoningSteps complete thoughtSeconds={3} steps={[{ label: "Set root node", status: "done" }]} />
          <div className="flex flex-wrap gap-2">
            <SourceChip kind="FARA" label="FARA #6843" onClick={() => setSource(SOURCE)} />
            <SourceChip kind="LDA" label="LDA Q1 2026" onClick={() => setSource({ ...SOURCE, kind: "LDA", title: "LDA Q1 2026 report: Meridian Public Affairs" })} />
            <SourceChip kind="CONGRESS" label="congress.gov" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="primary" icon={<Bookmark size={16} />} onClick={() => toast.show("Exploration saved")}>
              Save exploration
            </Button>
            <Button variant="secondary">Load checkpoint</Button>
            <Button variant="ghost">Cancel</Button>
          </div>
          <AskBar onSubmit={(q) => toast.show(`Asked: ${q}`)} placeholder="Ask about people, bills or connections" />
        </div>
      </Panel>
      <SourceDrawer source={source} onClose={() => setSource(null)} />
    </div>
  );
}

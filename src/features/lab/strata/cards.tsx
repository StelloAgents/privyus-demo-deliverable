import { BadgeDollarSign, Building2, Flag, Handshake, Plane, ScrollText, Vote, type LucideIcon } from "lucide-react";
import type { NodeKind, StrataNode } from "./graph";
import s from "./strata.module.css";

const ICON: Partial<Record<NodeKind, LucideIcon>> = {
  topic: Flag,
  bill: ScrollText,
  org: Building2,
  meeting: Handshake,
  money: BadgeDollarSign,
  trip: Plane,
  vote: Vote,
};

const KIND_NAME: Record<NodeKind, string> = {
  topic: "Topic",
  bill: "Bill",
  person: "Person",
  org: "Organization",
  meeting: "Meeting",
  money: "Contribution",
  trip: "Trip",
  vote: "Vote",
};

export function NodeCard({ node, variant, priority }: { node: StrataNode; variant: "focus" | "path" | "plain"; priority: number }) {
  const Icon = ICON[node.kind];
  const focus = variant === "focus";
  return (
    <div className={s.card} data-variant={variant} data-declutter={priority}>
      <span className={s.avatar} aria-hidden="true">
        {node.initials ?? (Icon ? <Icon size={focus ? 18 : 12} strokeWidth={1.5} /> : null)}
      </span>
      <span>
        <span className={s.name} style={{ display: "block" }}>
          {node.label}
        </span>
        <span className={s.sub} style={{ display: "block" }}>
          {node.sublabel}
        </span>
        {focus && (
          <span className={s.source}>
            <span className={s.chip}>{KIND_NAME[node.kind]}</span>
            {node.source ?? "Demo fixture"}
          </span>
        )}
      </span>
    </div>
  );
}

export function EdgeChip({ label, onPath, priority }: { label: string; onPath: boolean; priority: number }) {
  return (
    <div className={s.edgeChip} data-path={onPath || undefined} data-declutter={priority}>
      {label}
    </div>
  );
}

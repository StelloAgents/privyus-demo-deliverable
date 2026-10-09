import {
  BadgeDollarSign,
  Building2,
  Factory,
  Flag,
  Gavel,
  Handshake,
  Library,
  MessageSquareQuote,
  Plane,
  ScrollText,
  Vote,
  type LucideIcon,
} from "lucide-react";
import type { Glyph } from "./data";

const ICONS: Record<Glyph, LucideIcon> = {
  vote: Vote,
  trip: Plane,
  meeting: Handshake,
  contribution: BadgeDollarSign,
  statement: MessageSquareQuote,
  filing: Gavel,
  bill: ScrollText,
  topic: Flag,
  org: Building2,
  factory: Factory,
  library: Library,
};

/** The avatar disc on a card: initials for people, an icon for everything else. */
export function Avatar({ initials, glyph, size, focused }: { initials?: string; glyph?: Glyph; size: number; focused?: boolean }) {
  const Icon = glyph ? ICONS[glyph] : null;
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-surface-2"
      style={{
        width: size,
        height: size,
        boxShadow: `inset 0 0 0 1.5px var(${focused ? "--orange" : "--teal"})`,
      }}
    >
      {initials ? (
        <span className="font-display font-semibold text-fg-1" style={{ fontSize: size * 0.38, letterSpacing: "-0.01em" }}>
          {initials}
        </span>
      ) : Icon ? (
        <Icon size={Math.round(size * 0.46)} strokeWidth={1.5} className={focused ? "text-orange" : "text-teal-bright"} />
      ) : null}
    </span>
  );
}

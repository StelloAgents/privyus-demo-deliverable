import type { VoteTally } from "@/data/types";
import { houseStateVotes, senateSeats, votes } from "@/data/votes";
import { entities } from "@/data/entities";

export type { VoteTally };

export const VOTES: VoteTally[] = votes;

/** "Cloture on S. 456 · Defense Support Act" into "Cloture on S. 456". */
export function shortVoteLabel(label: string): string {
  return label.split(/\s+·\s+/)[0];
}

const byId = new Map(entities.map((e) => [e.id, e]));

export function billParts(billId: string): { number: string; title: string } {
  const label = byId.get(billId)?.label ?? billId;
  const [number, ...rest] = label.split(/\s+·\s+/);
  return { number, title: rest.join(" · ") };
}

export function memberLabel(id: string): string {
  const e = byId.get(id);
  return e ? `${e.label}${e.sublabel ? ` (${e.sublabel})` : ""}` : id;
}

/** "Senate" / "House" from the chamber field. */
export function chamberName(chamber: string): string {
  return /senate/i.test(chamber) ? "Senate" : /house/i.test(chamber) ? "House" : chamber;
}

export type Party = "R" | "D" | "I";
export type SeatVote = "yes" | "no" | "nv";

/** One seat in a chamber chart, linked to its state. */
export interface ChamberSeat {
  id: string;
  state: string;
  party: Party;
  vote: SeatVote;
  memberId?: string;
  /** The bill's sponsor: drawn with a ring. */
  sponsor?: boolean;
}

export const PARTY_NAME: Record<Party, string> = { R: "Republican", D: "Democrat", I: "Independent" };
export const VOTE_NAME: Record<SeatVote, string> = { yes: "Yes", no: "No", nv: "Not voting" };

const senateVote = votes.find((v) => v.chamber === "senate")!;
const houseVote = votes.find((v) => v.chamber === "house")!;

/** The Senate roll call, one seat per senator. */
export const SENATE_SEATS: ChamberSeat[] = senateSeats.map((s) => ({
  id: s.seatId,
  state: s.state,
  party: s.party,
  vote: s.vote,
  memberId: s.memberId,
  sponsor: s.memberId === senateVote.sponsorId,
}));

/** The House roll call, expanded from the per-state party counts. The sponsor sits in her state's party block. */
export const HOUSE_SEATS: ChamberSeat[] = (() => {
  const out: ChamberSeat[] = [];
  const sponsor = byId.get(houseVote.sponsorId);
  const sponsorState = sponsor?.sublabel?.split("-")[1];
  const sponsorParty = sponsor?.sublabel?.split("-")[0] as Party | undefined;
  let sponsorPlaced = false;
  for (const st of houseStateVotes) {
    for (const party of ["R", "D"] as const) {
      const c = st.byParty[party];
      for (const vote of ["yes", "no", "nv"] as const) {
        for (let i = 0; i < c[vote]; i++) {
          const isSponsor = !sponsorPlaced && vote === "yes" && party === sponsorParty && st.state === sponsorState;
          if (isSponsor) sponsorPlaced = true;
          out.push({ id: `${st.state}-${party}-${vote}-${i}`, state: st.state, party, vote, sponsor: isSponsor || undefined });
        }
      }
    }
  }
  return out;
})();

export function tally(seats: ChamberSeat[]) {
  const n = (f: (s: ChamberSeat) => boolean) => seats.filter(f).length;
  return {
    yes: n((s) => s.vote === "yes"),
    no: n((s) => s.vote === "no"),
    nv: n((s) => s.vote === "nv"),
    R: n((s) => s.party === "R"),
    D: n((s) => s.party === "D"),
    I: n((s) => s.party === "I"),
  };
}

export interface PlacedSeat extends ChamberSeat {
  row: number;
  x: number;
  y: number;
  r: number;
}

/**
 * A hemicycle: seats in semicircular rows, filled by angle from left to right.
 * Democrats sit on the left, Independents next, Republicans on the right. Inside each
 * party block the "no" votes sit toward the middle, so the two parties mirror each other.
 */
export function layoutChamber(seats: ChamberSeat[], width: number): { seats: PlacedSeat[]; height: number } {
  const total = seats.length;
  const rows = total > 200 ? 11 : total > 60 ? 7 : 4;
  const outer = width / 2;
  // A larger opening for the House, so the headline figure clears the inner seats.
  const inner = outer * (total > 200 ? 0.48 : 0.36);
  const step = (outer - inner) / rows;
  const radii = Array.from({ length: rows }, (_, i) => inner + step * (i + 0.5));
  const sum = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.floor((total * r) / sum));
  let left = total - counts.reduce((a, b) => a + b, 0);
  for (let i = rows - 1; left > 0; i = (i - 1 + rows) % rows, left--) counts[i]++;
  const dotR = Math.min(step * 0.38, 8);

  const pos: { x: number; y: number; a: number; row: number }[] = [];
  radii.forEach((r, row) => {
    const n = counts[row];
    for (let k = 0; k < n; k++) {
      const a = Math.PI - (n === 1 ? Math.PI / 2 : (Math.PI * k) / (n - 1));
      pos.push({ x: outer + r * Math.cos(a), y: outer - r * Math.sin(a), a, row });
    }
  });
  pos.sort((p, q) => q.a - p.a || p.row - q.row);

  const rank = (s: ChamberSeat) => {
    const party = { D: 0, I: 1, R: 2 }[s.party];
    const vote = s.party === "R" ? { no: 0, nv: 1, yes: 2 }[s.vote] : { yes: 0, nv: 1, no: 2 }[s.vote];
    return party * 10 + vote;
  };
  const ordered = [...seats].sort((a, b) => rank(a) - rank(b));
  const round = (n: number) => Math.round(n * 100) / 100;
  return {
    seats: ordered.map((s, i) => ({ ...s, row: pos[i].row, x: round(pos[i].x), y: round(pos[i].y), r: round(dotR) })),
    height: round(outer + dotR + 2),
  };
}

import type { HouseStateVote, SenateParty, SenateSeat, SeatVote, VoteTally } from './types';
import { S5025_COSPONSORS } from './entities';

/**
 * The two roll calls on Home, from the senate.gov and clerk.house.gov XML files
 * (src/data/records/real-records.json). scripts/check-real-records.ts checks every
 * seat and every state count against the fact base.
 */
const CAST = [...S5025_COSPONSORS, 'markey', 'warner'];

export const votes: VoteTally[] = [
  { billId: 'hr5334', chamber: 'senate', seats: 100, voteLabel: 'Passage of H.R. 5334 · Senate roll call 224', date: '2026-08-07', yes: 86, no: 11, notVoting: 3, memberIds: CAST, sourceId: 'roll-s224' },
  { billId: 'hr5334', chamber: 'house', seats: 435, voteLabel: 'Motion to concur in the Senate amendments to H.R. 5334 · House roll call 308', date: '2026-09-16', yes: 262, no: 159, notVoting: 12, notOnRoll: 2, memberIds: [], sourceId: 'roll-h308' },
];

type SeatRow = [party: SenateParty, vote: SeatVote, memberId?: string];

/** Senate roll call 224 (2026-08-07): two seats per state, alphabetical by state code. Members of this exploration carry a memberId. */
const senateRows: Record<string, [SeatRow, SeatRow]> = {
  AK: [['R', 'yes', 'murkowski'], ['R', 'yes', 'sullivan']],
  AL: [['R', 'yes'], ['R', 'yes']],
  AR: [['R', 'yes'], ['R', 'yes']],
  AZ: [['D', 'yes'], ['D', 'yes']],
  CA: [['D', 'no'], ['D', 'yes']],
  CO: [['D', 'yes'], ['D', 'yes']],
  CT: [['D', 'yes', 'blumenthal'], ['D', 'yes']],
  DE: [['D', 'no'], ['D', 'yes', 'coons']],
  FL: [['R', 'yes'], ['R', 'yes']],
  GA: [['D', 'no'], ['D', 'yes']],
  HI: [['D', 'no'], ['D', 'yes']],
  IA: [['R', 'yes', 'ernst'], ['R', 'yes']],
  ID: [['R', 'yes'], ['R', 'yes']],
  IL: [['D', 'yes'], ['D', 'yes', 'durbin']],
  IN: [['R', 'yes'], ['R', 'yes']],
  KS: [['R', 'yes'], ['R', 'yes']],
  KY: [['R', 'nv'], ['R', 'no']],
  LA: [['R', 'yes'], ['R', 'yes']],
  MA: [['D', 'no', 'markey'], ['D', 'no']],
  MD: [['D', 'yes'], ['D', 'yes', 'van-hollen']],
  ME: [['R', 'yes'], ['I', 'yes', 'king']],
  MI: [['D', 'yes'], ['D', 'yes']],
  MN: [['D', 'yes'], ['D', 'yes']],
  MO: [['R', 'yes'], ['R', 'yes']],
  MS: [['R', 'yes'], ['R', 'yes', 'wicker']],
  MT: [['R', 'yes', 'daines'], ['R', 'yes']],
  NC: [['R', 'yes'], ['R', 'yes', 'tillis']],
  ND: [['R', 'yes', 'cramer'], ['R', 'yes']],
  NE: [['R', 'yes', 'fischer'], ['R', 'yes']],
  NH: [['D', 'no'], ['D', 'yes', 'shaheen']],
  NJ: [['D', 'yes'], ['D', 'yes']],
  NM: [['D', 'yes', 'heinrich'], ['D', 'yes']],
  NV: [['D', 'yes'], ['D', 'yes']],
  NY: [['D', 'yes'], ['D', 'yes']],
  OH: [['R', 'yes'], ['R', 'yes']],
  OK: [['R', 'yes'], ['R', 'yes']],
  OR: [['D', 'yes'], ['D', 'no']],
  PA: [['D', 'yes'], ['R', 'yes']],
  RI: [['D', 'yes'], ['D', 'yes']],
  SC: [['R', 'yes'], ['R', 'yes']],
  SD: [['R', 'yes'], ['R', 'yes']],
  TN: [['R', 'nv'], ['R', 'yes']],
  TX: [['R', 'yes'], ['R', 'yes']],
  UT: [['R', 'yes'], ['R', 'yes']],
  VA: [['D', 'yes', 'kaine'], ['D', 'yes', 'warner']],
  VT: [['I', 'no'], ['D', 'no']],
  WA: [['D', 'yes'], ['D', 'yes']],
  WI: [['D', 'yes'], ['R', 'yes']],
  WV: [['R', 'yes'], ['R', 'yes']],
  WY: [['R', 'yes', 'barrasso'], ['R', 'nv']],
};

/** Senate seat chart for roll call 224: 100 seats (53 R, 45 D, 2 I). */
export const senateSeats: SenateSeat[] = Object.entries(senateRows).flatMap(([state, rows]) =>
  rows.map(([party, vote, memberId], index): SenateSeat => ({ seatId: `${state}-${index + 1}`, state, party, vote, ...(memberId ? { memberId } : {}) })),
);

/**
 * House roll call 308 (2026-09-16), counted by state and party from the clerk XML.
 * 433 members are on the roll; Florida and Texas each list one fewer member than their seat count.
 */
export const houseStateVotes: HouseStateVote[] = [
  { state: 'AK', seats: 1, byParty: { R: { yes: 1, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'AL', seats: 7, byParty: { R: { yes: 5, no: 0, nv: 0 }, D: { yes: 1, no: 1, nv: 0 } } },
  { state: 'AR', seats: 4, byParty: { R: { yes: 3, no: 0, nv: 1 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'AZ', seats: 9, byParty: { R: { yes: 5, no: 0, nv: 1 }, D: { yes: 0, no: 3, nv: 0 } } },
  { state: 'CA', seats: 52, byParty: { R: { yes: 6, no: 1, nv: 1 }, D: { yes: 8, no: 34, nv: 1 }, I: { yes: 1, no: 0, nv: 0 } } },
  { state: 'CO', seats: 8, byParty: { R: { yes: 4, no: 0, nv: 0 }, D: { yes: 1, no: 3, nv: 0 } } },
  { state: 'CT', seats: 5, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 0, no: 5, nv: 0 } } },
  { state: 'DE', seats: 1, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 0, no: 1, nv: 0 } } },
  { state: 'FL', seats: 27, byParty: { R: { yes: 16, no: 0, nv: 4 }, D: { yes: 3, no: 3, nv: 1 } } },
  { state: 'GA', seats: 14, byParty: { R: { yes: 9, no: 0, nv: 0 }, D: { yes: 1, no: 4, nv: 0 } } },
  { state: 'HI', seats: 2, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 2, no: 0, nv: 0 } } },
  { state: 'IA', seats: 4, byParty: { R: { yes: 4, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'ID', seats: 2, byParty: { R: { yes: 2, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'IL', seats: 17, byParty: { R: { yes: 3, no: 0, nv: 0 }, D: { yes: 4, no: 10, nv: 0 } } },
  { state: 'IN', seats: 9, byParty: { R: { yes: 7, no: 0, nv: 0 }, D: { yes: 1, no: 1, nv: 0 } } },
  { state: 'KS', seats: 4, byParty: { R: { yes: 3, no: 0, nv: 0 }, D: { yes: 0, no: 1, nv: 0 } } },
  { state: 'KY', seats: 6, byParty: { R: { yes: 4, no: 1, nv: 0 }, D: { yes: 0, no: 1, nv: 0 } } },
  { state: 'LA', seats: 6, byParty: { R: { yes: 4, no: 0, nv: 0 }, D: { yes: 0, no: 2, nv: 0 } } },
  { state: 'MA', seats: 9, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 3, no: 6, nv: 0 } } },
  { state: 'MD', seats: 8, byParty: { R: { yes: 0, no: 1, nv: 0 }, D: { yes: 3, no: 4, nv: 0 } } },
  { state: 'ME', seats: 2, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 2, no: 0, nv: 0 } } },
  { state: 'MI', seats: 13, byParty: { R: { yes: 7, no: 0, nv: 0 }, D: { yes: 2, no: 4, nv: 0 } } },
  { state: 'MN', seats: 8, byParty: { R: { yes: 4, no: 0, nv: 0 }, D: { yes: 0, no: 4, nv: 0 } } },
  { state: 'MO', seats: 8, byParty: { R: { yes: 6, no: 0, nv: 0 }, D: { yes: 1, no: 1, nv: 0 } } },
  { state: 'MS', seats: 4, byParty: { R: { yes: 3, no: 0, nv: 0 }, D: { yes: 0, no: 1, nv: 0 } } },
  { state: 'MT', seats: 2, byParty: { R: { yes: 2, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'NC', seats: 14, byParty: { R: { yes: 10, no: 0, nv: 0 }, D: { yes: 1, no: 3, nv: 0 } } },
  { state: 'ND', seats: 1, byParty: { R: { yes: 1, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'NE', seats: 3, byParty: { R: { yes: 3, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'NH', seats: 2, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 0, no: 2, nv: 0 } } },
  { state: 'NJ', seats: 12, byParty: { R: { yes: 3, no: 0, nv: 0 }, D: { yes: 2, no: 7, nv: 0 } } },
  { state: 'NM', seats: 3, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 2, no: 1, nv: 0 } } },
  { state: 'NV', seats: 4, byParty: { R: { yes: 1, no: 0, nv: 0 }, D: { yes: 2, no: 1, nv: 0 } } },
  { state: 'NY', seats: 26, byParty: { R: { yes: 7, no: 0, nv: 0 }, D: { yes: 7, no: 12, nv: 0 } } },
  { state: 'OH', seats: 15, byParty: { R: { yes: 9, no: 1, nv: 0 }, D: { yes: 2, no: 3, nv: 0 } } },
  { state: 'OK', seats: 5, byParty: { R: { yes: 5, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'OR', seats: 6, byParty: { R: { yes: 1, no: 0, nv: 0 }, D: { yes: 0, no: 5, nv: 0 } } },
  { state: 'PA', seats: 17, byParty: { R: { yes: 10, no: 0, nv: 0 }, D: { yes: 2, no: 4, nv: 1 } } },
  { state: 'RI', seats: 2, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 1, no: 1, nv: 0 } } },
  { state: 'SC', seats: 7, byParty: { R: { yes: 5, no: 1, nv: 0 }, D: { yes: 1, no: 0, nv: 0 } } },
  { state: 'SD', seats: 1, byParty: { R: { yes: 1, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'TN', seats: 9, byParty: { R: { yes: 8, no: 0, nv: 0 }, D: { yes: 1, no: 0, nv: 0 } } },
  { state: 'TX', seats: 37, byParty: { R: { yes: 22, no: 2, nv: 0 }, D: { yes: 3, no: 10, nv: 0 } } },
  { state: 'UT', seats: 4, byParty: { R: { yes: 4, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'VA', seats: 11, byParty: { R: { yes: 5, no: 0, nv: 0 }, D: { yes: 1, no: 5, nv: 0 } } },
  { state: 'VT', seats: 1, byParty: { R: { yes: 0, no: 0, nv: 0 }, D: { yes: 0, no: 1, nv: 0 } } },
  { state: 'WA', seats: 10, byParty: { R: { yes: 2, no: 0, nv: 0 }, D: { yes: 1, no: 6, nv: 1 } } },
  { state: 'WI', seats: 8, byParty: { R: { yes: 5, no: 0, nv: 1 }, D: { yes: 0, no: 2, nv: 0 } } },
  { state: 'WV', seats: 2, byParty: { R: { yes: 2, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
  { state: 'WY', seats: 1, byParty: { R: { yes: 1, no: 0, nv: 0 }, D: { yes: 0, no: 0, nv: 0 } } },
];

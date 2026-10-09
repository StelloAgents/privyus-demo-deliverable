export type EntityType = "topic" | "bill" | "person" | "category" | "detail" | "org";
export type SourceKind = "FARA" | "LDA" | "FEC" | "CONGRESS" | "DISCLOSURE" | "TRAVEL" | "STATEMENT";
export interface Entity { id: string; type: EntityType; label: string; sublabel?: string; initials?: string; icon?: string; categoryOf?: string; /** Two-letter home state (or "DC") for org entities. */ hqState?: string; }
export interface Edge { id: string; source: string; target: string; label: string; date?: string; sourceIds: string[]; }
export interface SourceDoc { id: string; kind: SourceKind; title: string; date: string; excerpt: string; subjectIds?: string[]; /** State codes for the map connection: from (origin org or DC) to (member state). */ geo?: { from?: string; to?: string }; }
export interface GraphDelta { add: { entities: string[]; edges: string[] }; ghost?: { entities: string[]; edges: string[] }; focus?: string; expand?: string; }
export interface ScriptTurn { id: string; trigger: { question?: string; keywords?: string[]; nodeClick?: string }; steps: { label: string; delta: GraphDelta }[]; answer: string; citations: string[]; suggestions: string[]; }
export interface VoteTally { billId: string; chamber: 'senate' | 'house'; seats: 100 | 435; voteLabel: string; date: string; yes: number; no: number; notVoting: number; sponsorId: string; cosponsorIds: string[]; sourceId: string; }
export type SenateParty = 'R' | 'D' | 'I';
export type SeatVote = 'yes' | 'no' | 'nv';
export interface SenateSeat { seatId: string; state: string; party: SenateParty; vote: SeatVote; memberId?: string; }
export interface PartyVoteCount { yes: number; no: number; nv: number; }
export interface HouseStateVote { state: string; seats: number; byParty: { R: PartyVoteCount; D: PartyVoteCount }; }
export interface StateInfo { code: string; name: string; lat: number; lng: number; /** True for the District of Columbia, which is not one of the 50 states. */ district?: boolean; }

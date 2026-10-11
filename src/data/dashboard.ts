export interface KpiTile { id: string; label: string; value: number; change: string; series: number[]; }
export interface WatchlistEntry { id: string; entityId: string; label: string; kind: 'person' | 'bill'; note: string; }
export interface RadarTopic { id: string; title: string; description: string; counters: { travels: number; donations: number; bills: number; members: number; organizations: number }; entityId?: string; }
export interface ActivityRow { id: string; date: string; kind: 'vote' | 'travel' | 'hearing' | 'statement'; title: string; description: string; entityId?: string; /** The public record behind the row (sources.ts). */ sourceId?: string; }
export interface Checkpoint { id: string; title: string; date: string; summary: string; counts: { members: number; bills: number; organizations: number; travels: number }; entityId: string; }
export interface DashboardFixtures { greeting: string; kpis: KpiTile[]; watchlist: WatchlistEntry[]; radar: RadarTopic[]; activity: ActivityRow[]; checkpoints: Checkpoint[]; }

/*
 * Home fixtures. KPI tiles, radar counters, and checkpoint counts are
 * illustrative aggregates (covered by the footer disclaimer). Watchlist notes and
 * every activity row come from a public record in sources.ts (`sourceId`).
 */
export const dashboard: DashboardFixtures = {
  greeting: 'What can I help you solve today?',
  kpis: [
    { id: 'active-members', label: 'Active members', value: 47, change: '+12 this month', series: [24, 26, 25, 29, 31, 30, 34, 36, 39, 38, 43, 47] },
    { id: 'new-activity', label: 'New activity', value: 128, change: '+18 this week', series: [61, 67, 72, 69, 78, 85, 83, 94, 103, 101, 116, 128] },
    { id: 'reports-generated', label: 'Reports generated', value: 23, change: '+4 this month', series: [6, 7, 8, 8, 10, 11, 13, 14, 17, 18, 19, 23] },
  ],
  watchlist: [
    { id: 'watch-wicker', entityId: 'wicker', label: 'Sen. Roger Wicker', kind: 'person', note: 'Statement on Sep 28, 2026 · R-MS' },
    { id: 'watch-blumenthal', entityId: 'blumenthal', label: 'Sen. Richard Blumenthal', kind: 'person', note: 'Statement on Sep 16, 2026 · D-CT' },
    { id: 'watch-hr5334', entityId: 'hr5334', label: 'H.R. 5334 · Russia and Iran sanctions act, 2026', kind: 'bill', note: 'Became P.L. 119-111 on Sep 18, 2026' },
    { id: 'watch-s5025', entityId: 's5025', label: 'S. 5025 · Russia sanctions bill, 2026', kind: 'bill', note: 'Referred to Banking on Jul 16, 2026' },
  ],
  radar: [
    { id: 'radar-ukraine', title: 'Russia Sanctions and Ukraine', description: 'Tracking legislative progress. 47 legislators active. 12 new.', entityId: 'ukraine', counters: { travels: 43, donations: 86, bills: 3, members: 47, organizations: 18 } },
    { id: 'radar-industrial', title: 'Defense PAC Giving', description: '29 legislators active. 5 new.', counters: { travels: 11, donations: 62, bills: 4, members: 29, organizations: 24 } },
    { id: 'radar-allied', title: 'Foreign Lobbying Contacts', description: '36 legislators active. 8 new.', counters: { travels: 27, donations: 31, bills: 2, members: 36, organizations: 13 } },
  ],
  activity: [
    { id: 'activity-01', date: '2026-09-28', kind: 'statement', title: 'Wicker weekly report on the sanctions law', description: 'Column on the tools the new law gives the president.', entityId: 'wicker', sourceId: 'stmt-wicker-0928' },
    { id: 'activity-02', date: '2026-09-18', kind: 'vote', title: 'H.R. 5334 becomes Public Law 119-111', description: 'Signed by the President on Sep 18, 2026.', entityId: 'hr5334', sourceId: 'bill-hr5334' },
    { id: 'activity-03', date: '2026-09-16', kind: 'vote', title: 'House agrees to Senate amendments, 262-159', description: 'House roll call 308 on H.R. 5334.', entityId: 'hr5334', sourceId: 'roll-h308' },
    { id: 'activity-04', date: '2026-09-16', kind: 'statement', title: 'Blumenthal statement after the House vote', description: 'Quoted by Roll Call.', entityId: 'blumenthal', sourceId: 'stmt-blumenthal-0916' },
    { id: 'activity-05', date: '2026-08-11', kind: 'statement', title: 'Shaheen on the House sanctions bill', description: 'Senate Foreign Relations minority release.', entityId: 'shaheen', sourceId: 'stmt-shaheen-0811' },
    { id: 'activity-06', date: '2026-08-07', kind: 'vote', title: 'Senate passes H.R. 5334, 86-11', description: 'Senate roll call 224, with an amendment.', entityId: 'hr5334', sourceId: 'roll-s224' },
    { id: 'activity-07', date: '2026-08-07', kind: 'statement', title: 'Wicker release on the sanctions bill', description: 'Press release after Senate passage.', entityId: 'wicker', sourceId: 'stmt-wicker-0807' },
    { id: 'activity-08', date: '2026-08-07', kind: 'statement', title: 'Cramer release on the Senate vote', description: 'Press release after Senate passage.', entityId: 'cramer', sourceId: 'stmt-cramer-0807' },
    { id: 'activity-09', date: '2026-08-06', kind: 'statement', title: 'Wicker statement on NATO allies', description: 'Press release on Russian escalation.', entityId: 'wicker', sourceId: 'stmt-wicker-0806' },
    { id: 'activity-10', date: '2026-07-28', kind: 'vote', title: 'Senate cloture on H.R. 5334, 86-12', description: 'Senate roll call 212, motion to proceed.', entityId: 'hr5334', sourceId: 'roll-s212' },
    { id: 'activity-11', date: '2026-07-23', kind: 'statement', title: 'Coons release on the Russian oil sanctions bill', description: 'Press release with a Blumenthal quote.', entityId: 'coons', sourceId: 'stmt-coons-0723' },
    { id: 'activity-12', date: '2026-03-25', kind: 'hearing', title: 'Foreign Relations closed briefing on Ukraine', description: 'Update on the Russia-Ukraine War.', entityId: 'ukraine', sourceId: 'hearing-sfrc-0325' },
  ],
  checkpoints: [
    { id: 'checkpoint-ukraine-2025', title: 'Exploration, 9/20/2026', date: '2026-09-20', summary: 'Central: Ukraine. 12 members, 3 bills, 1 org, 4 travels', counts: { members: 12, bills: 3, organizations: 1, travels: 4 }, entityId: 'ukraine' },
    { id: 'checkpoint-wicker-2026', title: 'Exploration, 5/28/2026', date: '2026-05-28', summary: 'Central: Sen. Roger Wicker. 7 members, 2 bills, 3 orgs, 1 travel', counts: { members: 7, bills: 2, organizations: 3, travels: 1 }, entityId: 'wicker' },
    { id: 'checkpoint-s5025-2026', title: 'Exploration, 8/14/2026', date: '2026-08-14', summary: 'Central: S. 5025 · Russia sanctions bill, 2026. 17 members, 1 bill, 0 orgs, 0 travels', counts: { members: 17, bills: 1, organizations: 0, travels: 0 }, entityId: 's5025' },
  ],
};

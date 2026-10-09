export interface KpiTile { id: string; label: string; value: number; change: string; series: number[]; }
export interface WatchlistEntry { id: string; entityId: string; label: string; kind: 'person' | 'bill'; note: string; }
export interface RadarTopic { id: string; title: string; description: string; counters: { travels: number; donations: number; bills: number; members: number; organizations: number }; entityId?: string; }
export interface ActivityRow { id: string; date: string; kind: 'vote' | 'travel' | 'hearing' | 'statement'; title: string; description: string; entityId?: string; }
export interface Checkpoint { id: string; title: string; date: string; summary: string; counts: { members: number; bills: number; organizations: number; travels: number }; entityId: string; }
export interface DashboardFixtures { greeting: string; kpis: KpiTile[]; watchlist: WatchlistEntry[]; radar: RadarTopic[]; activity: ActivityRow[]; checkpoints: Checkpoint[]; }

export const dashboard: DashboardFixtures = {
  greeting: 'What can I help you solve today?',
  kpis: [
    { id: 'active-members', label: 'Active members', value: 47, change: '+12 this month', series: [24, 26, 25, 29, 31, 30, 34, 36, 39, 38, 43, 47] },
    { id: 'new-activity', label: 'New activity', value: 128, change: '+18 this week', series: [61, 67, 72, 69, 78, 85, 83, 94, 103, 101, 116, 128] },
    { id: 'reports-generated', label: 'Reports generated', value: 23, change: '+4 this month', series: [6, 7, 8, 8, 10, 11, 13, 14, 17, 18, 19, 23] },
  ],
  watchlist: [
    { id: 'watch-hartley', entityId: 'hartley', label: 'Sen. Ellen Hartley', kind: 'person', note: 'New committee activity · R-OH' },
    { id: 'watch-kessler', entityId: 'kessler', label: 'Rep. Miriam Kessler', kind: 'person', note: 'Ukraine aid sponsor · D-PA' },
    { id: 'watch-s456', entityId: 's456', label: 'S. 456 · Defense Support Act', kind: 'bill', note: 'Senate floor action' },
    { id: 'watch-hr123', entityId: 'hr123', label: 'H.R. 123 · Ukraine Aid Act', kind: 'bill', note: 'House committee review' },
  ],
  radar: [
    { id: 'radar-ukraine', title: 'Ukraine Aid Package', description: 'Tracking legislative progress. 47 legislators active. 12 new.', entityId: 'ukraine', counters: { travels: 43, donations: 86, bills: 3, members: 47, organizations: 18 } },
    { id: 'radar-industrial', title: 'Defense Industrial Base', description: '29 legislators active. 5 new.', entityId: 's456', counters: { travels: 11, donations: 62, bills: 4, members: 29, organizations: 24 } },
    { id: 'radar-allied', title: 'Allied Security Coordination', description: '36 legislators active. 8 new.', entityId: 'ukraine', counters: { travels: 27, donations: 31, bills: 2, members: 36, organizations: 13 } },
  ],
  activity: [
    { id: 'activity-01', date: '2026-09-24', kind: 'statement', title: 'Hartley calls for transfer oversight', description: 'Statement on the next security assistance review.', entityId: 'hartley' },
    { id: 'activity-02', date: '2026-09-17', kind: 'hearing', title: 'Kessler joins aid oversight hearing', description: 'House panel reviews delivery reporting.', entityId: 'kessler' },
    { id: 'activity-03', date: '2026-09-09', kind: 'travel', title: 'Marquez visits allied logistics hub', description: 'Delegation briefing in Warsaw.', entityId: 'marquez' },
    { id: 'activity-04', date: '2026-08-26', kind: 'statement', title: 'Rourke comments on replenishment', description: 'Press remarks on stockpile funding.', entityId: 'rourke' },
    { id: 'activity-05', date: '2026-08-05', kind: 'hearing', title: 'Hartley questions supply chain witnesses', description: 'Senate hearing on production capacity.', entityId: 'hartley' },
    { id: 'activity-06', date: '2026-07-22', kind: 'statement', title: 'Hartley urges allied cost sharing', description: 'Interview on Ukraine assistance.', entityId: 'hartley' },
    { id: 'activity-07', date: '2026-07-09', kind: 'travel', title: 'Hartley attends Brussels briefing', description: 'NATO security consultations.', entityId: 'hartley' },
    { id: 'activity-08', date: '2026-06-11', kind: 'vote', title: 'Hartley rejects export pause', description: 'Senate roll call on transfer authority.', entityId: 'hartley' },
    { id: 'activity-09', date: '2026-05-21', kind: 'vote', title: 'S. 456 advances on cloture', description: 'Hartley votes yes on the Senate motion.', entityId: 's456' },
    { id: 'activity-10', date: '2026-04-29', kind: 'hearing', title: 'Embassy delegation meets Hartley', description: 'Office calendar records the delegation.', entityId: 'hartley' },
    { id: 'activity-11', date: '2026-03-12', kind: 'travel', title: 'Hartley delegation visits Kyiv', description: 'Security briefing with Ukrainian officials.', entityId: 'hartley' },
    { id: 'activity-12', date: '2025-11-19', kind: 'vote', title: 'Ukraine aid package vote recorded', description: 'Hartley votes yes on the package.', entityId: 'hr123' },
  ],
  checkpoints: [
    { id: 'checkpoint-ukraine-2025', title: 'Exploration, 9/16/2025', date: '2025-09-16', summary: 'Central: Ukraine. 12 members, 3 bills, 1 org, 43 travels', counts: { members: 12, bills: 3, organizations: 1, travels: 43 }, entityId: 'ukraine' },
    { id: 'checkpoint-hartley-2026', title: 'Exploration, 5/28/2026', date: '2026-05-28', summary: 'Central: Sen. Ellen Hartley. 7 members, 2 bills, 3 orgs, 3 travels', counts: { members: 7, bills: 2, organizations: 3, travels: 3 }, entityId: 'hartley' },
    { id: 'checkpoint-s456-2026', title: 'Exploration, 8/14/2026', date: '2026-08-14', summary: 'Central: S. 456 · Defense Support Act. 7 members, 1 bill, 3 orgs, 4 travels', counts: { members: 7, bills: 1, organizations: 3, travels: 4 }, entityId: 's456' },
  ],
};

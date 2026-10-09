import { ActivityFeed } from "./ActivityFeed";
import { AskHero } from "./AskHero";
import { CheckpointsPanel } from "./CheckpointsPanel";
import { GlobePanel } from "./GlobePanel";
import { HomeGate } from "./HomeGate";
import { LiveTicker } from "./live";
import { RadarCard } from "./RadarCard";
import { WatchlistPanel } from "./WatchlistPanel";

/**
 * Main Dashboard (Screen 1), after concept 5 ("radar lead").
 * Row 1: the greeting on the left, the ask bar on the right (1.1).
 * Row 2: the Radar card with the KPIs and the trend or seat chart (1.4, 1.2), and the
 * network map as a large globe (1.6), about 45/55.
 * Row 3: Watchlist (1.3), Activity (1.5), Checkpoints (1.7), two rows each.
 * Live data: every ~20s a public record arrives (activity row, KPI count-up, globe arc).
 */
export function Dashboard() {
  return (
    <div className="h-workspace grid min-h-[640px] grid-rows-[auto_minmax(0,1fr)_220px] gap-4 [@media(min-height:1000px)]:grid-rows-[auto_minmax(0,1fr)_230px]">
      <HomeGate />
      <LiveTicker />
      <AskHero />
      <div className="grid min-h-0 grid-cols-[minmax(0,45fr)_minmax(0,55fr)] gap-4">
        <RadarCard />
        <GlobePanel />
      </div>
      <div className="grid min-h-0 grid-cols-3 gap-4">
        <WatchlistPanel className="min-h-0" />
        <ActivityFeed className="min-h-0" />
        <CheckpointsPanel className="min-h-0" />
      </div>
    </div>
  );
}

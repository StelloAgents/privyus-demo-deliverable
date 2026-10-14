const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The demo's "today". Fixed so that the server and the client render the same text. */
const CURRENT_YEAR = 2026;

/** "Sep 24" in the current year, "Nov 19, 2025" before it. Uses UTC so it is stable. */
export function shortDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  const md = `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  return d.getUTCFullYear() === CURRENT_YEAR ? md : `${md}, ${d.getUTCFullYear()}`;
}

/** Splits "+12 this month" into the delta ("+12") and the caption ("this month"). */
export function splitChange(change: string): { delta: string; caption?: string } {
  const m = change.trim().match(/^([+\-−]?[\d.,]+%?)\s*(.*)$/);
  if (!m) return { delta: change };
  return { delta: m[1], caption: m[2] || undefined };
}

/** "May 21, 2026". Uses UTC so it is stable. */
export function fullDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

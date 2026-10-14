import { STATEMENTS, type PublicStatement } from "./data";

/** Public statements, newest first. Optionally for one person only. */
export function statementsFor(personId?: string): PublicStatement[] {
  return STATEMENTS.filter((s) => !personId || s.personId === personId).sort((a, b) => b.date.localeCompare(a.date));
}

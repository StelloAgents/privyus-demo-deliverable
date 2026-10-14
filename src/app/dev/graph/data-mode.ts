/** The real fixtures from src/data/, for `/dev/graph?data=real`. Read-only use. */
import { buildCatalog } from "@/lib/catalog";
import { edges, entities } from "@/data/entities";
import { sources } from "@/data/sources";
import { script } from "@/data/script";

export const realCatalog = buildCatalog({ entities, edges, sources });
export const realTurns = script;

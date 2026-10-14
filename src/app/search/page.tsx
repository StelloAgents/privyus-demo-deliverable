import { SearchClient } from "@/features/search/SearchClient";

export const metadata = {
  title: "Search",
  description: "Find any member, bill, organization, or filing in the public record by name.",
};

/** The Search page. The page logic lives in src/features/search/. */
export default function SearchPage() {
  return <SearchClient />;
}

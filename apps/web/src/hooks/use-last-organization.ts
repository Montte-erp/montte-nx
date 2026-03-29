import { useLocalStorage } from "foxact/use-local-storage";

const STORAGE_KEY = "montte:last-organization-slug";

export function useLastOrganization() {
   const [lastSlug, setLastSlug] = useLocalStorage<string | null>(
      STORAGE_KEY,
      null,
   );
   return {
      lastSlug,
      setLastSlug: (slug: string) => setLastSlug(slug),
   };
}

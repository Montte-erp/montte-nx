import { useParams } from "@tanstack/react-router";

export function useOrgSlug() {
	return useParams({
		from: "/_authenticated/$slug/$teamSlug/_dashboard",
		select: (p) => p.slug,
	});
}

export function useTeamSlug() {
	return useParams({
		from: "/_authenticated/$slug/$teamSlug/_dashboard",
		select: (p) => p.teamSlug,
	});
}

import { useParams } from "@tanstack/react-router";

export function useOrgSlug() {
	const params = useParams({
		from: "/_authenticated/$slug/$teamSlug/_dashboard",
	});
	return params.slug ?? "";
}

export function useTeamSlug() {
	const params = useParams({
		from: "/_authenticated/$slug/$teamSlug/_dashboard",
	});
	return params.teamSlug ?? "";
}

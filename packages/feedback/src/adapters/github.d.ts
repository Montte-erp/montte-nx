import type { Octokit } from "@octokit/rest";
import type { FeedbackAdapter } from "../schemas";
type GitHubAdapterConfig = {
   octokit: Octokit;
   owner: string;
   repo: string;
};
export declare function githubAdapter(
   config: GitHubAdapterConfig,
): FeedbackAdapter;
export {};
//# sourceMappingURL=github.d.ts.map

import { beforeEach, describe, expect, it, vi } from "vitest";

const {
   loggerErrorMock,
   loggerChildMock,
   octokitCreateMock,
   octokitConstructorMock,
   posthogCaptureMock,
} = vi.hoisted(() => ({
   loggerErrorMock: vi.fn(),
   loggerChildMock: vi.fn(),
   octokitCreateMock: vi.fn(),
   octokitConstructorMock: vi.fn(),
   posthogCaptureMock: vi.fn(),
}));

vi.mock("@core/environment/web/server", () => ({
   env: {
      DISCORD_FEEDBACK_WEBHOOK_URL: "https://discord.example/webhook",
      GITHUB_FEEDBACK_OWNER: "contentta",
      GITHUB_FEEDBACK_REPO: "platform",
      GITHUB_FEEDBACK_TOKEN: "github-token",
   },
}));

vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: loggerChildMock.mockReturnValue({
         child: loggerChildMock,
         error: loggerErrorMock,
      }),
   }),
}));

vi.mock("@core/posthog/server", () => ({
   posthog: {
      capture: posthogCaptureMock,
   },
}));

vi.mock("@octokit/rest", () => ({
   Octokit: function MockOctokit(...args: unknown[]) {
      octokitConstructorMock(...args);
      return {
         issues: {
            create: octokitCreateMock,
         },
      };
   },
}));

describe("feedbackSender", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("creates env-backed adapters at module load time", async () => {
      const { feedbackSender } = await import("../src/sender");

      expect(feedbackSender).toBeDefined();
      expect(octokitConstructorMock).toHaveBeenCalledWith({
         auth: "github-token",
      });
   });

   it("sends feedback through posthog github and discord adapters", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         statusText: "OK",
      });
      vi.stubGlobal("fetch", fetchMock);

      const { feedbackSender } = await import("../src/sender");

      await feedbackSender.send({
         userId: "user-1",
         payload: {
            type: "feature_request",
            feature: "Bulk edit",
            problem: "Too slow manually",
            priority: 4,
         },
      });

      expect(posthogCaptureMock).toHaveBeenCalledWith({
         distinctId: "user-1",
         event: "survey sent",
         properties: {
            $survey_id: "019c6be5-5783-0000-684e-aceb5002b650",
            $survey_response: "Bulk edit",
            $survey_response_1: "Too slow manually",
            $survey_response_2: 4,
         },
      });
      expect(octokitCreateMock).toHaveBeenCalledWith({
         owner: "contentta",
         repo: "platform",
         title: "[Feature] Bulk edit",
         body: [
            "## Feature Request",
            "",
            "### Funcionalidade",
            "Bulk edit",
            "",
            "### Problema que resolve",
            "Too slow manually",
            "",
            "### Prioridade: ⭐⭐⭐⭐",
         ].join("\n"),
         labels: ["feature-request", "triage"],
      });
      expect(fetchMock).toHaveBeenCalledOnce();
      expect(fetchMock).toHaveBeenCalledWith(
         "https://discord.example/webhook?wait=true",
         expect.objectContaining({
            method: "POST",
         }),
      );

      vi.unstubAllGlobals();
   });

   it("logs adapter failures without rejecting send", async () => {
      const fetchMock = vi.fn().mockResolvedValue({
         ok: true,
         status: 200,
         statusText: "OK",
      });
      vi.stubGlobal("fetch", fetchMock);
      octokitCreateMock.mockRejectedValueOnce(new Error("github down"));

      const { feedbackSender } = await import("../src/sender");

      await expect(
         feedbackSender.send({
            userId: "user-2",
            payload: {
               type: "bug_report",
               description: "The page crashes",
               severity: "high",
            },
         }),
      ).resolves.toBeUndefined();

      expect(loggerErrorMock).toHaveBeenCalledWith(
         expect.objectContaining({
            adapter: "github",
            err: expect.any(Error),
         }),
         "Adapter failed",
      );

      vi.unstubAllGlobals();
   });
});

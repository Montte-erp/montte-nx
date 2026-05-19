export type AiTraceAttributeValue = string | number | boolean;

export interface AiTraceContext {
   distinctId: string;
   userId?: string;
   organizationId?: string;
   teamId?: string;
   threadId?: string;
   runId?: string;
   promptName?: string;
   promptVersion?: number;
   customProperties?: Record<string, AiTraceAttributeValue>;
}

export function aiTraceAttributes(context: AiTraceContext) {
   return {
      ...context.customProperties,
      "posthog.distinct_id": context.distinctId,
      ...(context.userId && { "user.id": context.userId }),
      ...(context.organizationId && {
         "organization.id": context.organizationId,
         "$groups.organization": context.organizationId,
      }),
      ...(context.teamId && {
         "team.id": context.teamId,
         "$groups.team": context.teamId,
      }),
      ...(context.threadId && {
         "thread.id": context.threadId,
         "gen_ai.conversation.id": context.threadId,
      }),
      ...(context.runId && {
         "gen_ai.run.id": context.runId,
      }),
      ...(context.promptName && {
         $ai_prompt_name: context.promptName,
         "tanstack.ai.prompt.name": context.promptName,
      }),
      ...(context.promptVersion !== undefined && {
         $ai_prompt_version: context.promptVersion,
         "tanstack.ai.prompt.version": context.promptVersion,
      }),
   };
}

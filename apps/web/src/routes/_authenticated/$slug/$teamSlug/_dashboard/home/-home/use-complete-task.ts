import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "@/integrations/orpc/client";

export function useCompleteTask() {
   const queryClient = useQueryClient();

   return useMutation(
      orpc.onboarding.completeTask.mutationOptions({
         onMutate: async (variables) => {
            const queryKey = orpc.onboarding.getOnboardingStatus.queryOptions(
               {},
            ).queryKey;
            await queryClient.cancelQueries({ queryKey });

            const previous = queryClient.getQueryData(queryKey);

            // biome-ignore lint/suspicious/noExplicitAny: onboarding tasks type is opaque from Better Auth
            queryClient.setQueryData(queryKey, (old: any) => {
               if (!old) return old;
               return {
                  ...old,
                  project: {
                     ...old.project,
                     tasks: {
                        ...(old.project.tasks ?? {}),
                        [variables.taskId]: true,
                     },
                  },
               };
            });

            return { previous };
         },
         onError: (_err, _variables, context) => {
            if (context?.previous) {
               const queryKey =
                  orpc.onboarding.getOnboardingStatus.queryOptions({}).queryKey;
               queryClient.setQueryData(queryKey, context.previous);
            }
         },
         onSettled: () => {
            const queryKey = orpc.onboarding.getOnboardingStatus.queryOptions(
               {},
            ).queryKey;
            queryClient.invalidateQueries({ queryKey });
         },
      }),
   );
}

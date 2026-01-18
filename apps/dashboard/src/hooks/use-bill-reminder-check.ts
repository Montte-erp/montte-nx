import { useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { useTRPC } from "@/integrations/clients";

const STORAGE_KEY = "bill-reminder-last-check";
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000; // 4 hours

interface UseBillReminderCheckOptions {
   enabled?: boolean;
   reminderDaysBefore?: number;
}

export function useBillReminderCheck(
   options: UseBillReminderCheckOptions = {},
) {
   const { enabled = true, reminderDaysBefore } = options;
   const trpc = useTRPC();

   const checkMutation = useMutation(
      trpc.pushNotifications.checkBillReminders.mutationOptions(),
   );

   useEffect(() => {
      if (!enabled) return;

      const lastCheck = localStorage.getItem(STORAGE_KEY);
      const now = Date.now();

      if (lastCheck && now - parseInt(lastCheck, 10) < CHECK_INTERVAL_MS) {
         return; // Skip if checked recently
      }

      localStorage.setItem(STORAGE_KEY, now.toString());
      checkMutation.mutate(
         reminderDaysBefore ? { reminderDaysBefore } : undefined,
      );
   }, [enabled, reminderDaysBefore]); // Remove checkMutation from deps

   return {
      error: checkMutation.error,
      isChecking: checkMutation.isPending,
      recheck: () => {
         checkMutation.mutate(
            reminderDaysBefore ? { reminderDaysBefore } : undefined,
         );
      },
      results: checkMutation.data?.results,
   };
}

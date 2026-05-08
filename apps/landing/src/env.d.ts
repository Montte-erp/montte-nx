declare global {
   interface PostHogStub {
      __loaded?: boolean;
      get_distinct_id: () => string;
      identify: (
         distinctId: string,
         properties?: Record<string, unknown>,
      ) => void;
      capture: (event: string, properties?: Record<string, unknown>) => void;
   }

   interface Window {
      posthog?: PostHogStub;
   }
}

export {};

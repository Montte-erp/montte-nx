import { useLocalStorage } from "foxact/use-local-storage";
import { motion, AnimatePresence } from "motion/react";
import { Cookie } from "lucide-react";
import {
   Alert,
   AlertDescription,
   AlertTitle,
} from "@packages/ui/components/alert";
import { Button } from "@packages/ui/components/button";

type Consent = "accepted" | "rejected";

export function CookieConsent() {
   const [consent, setConsent] = useLocalStorage<Consent | null>(
      "montte:cookie-consent",
      null,
   );

   const accept = () => {
      window.posthog?.opt_in_capturing();
      setConsent("accepted");
   };

   const reject = () => {
      window.posthog?.opt_out_capturing();
      setConsent("rejected");
   };

   return (
      <AnimatePresence>
         {consent === null ? (
            <motion.div
               initial={{ opacity: 0, y: 32 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: 32 }}
               transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
               className="fixed right-4 bottom-4 left-4 z-50 max-w-sm sm:left-auto"
            >
               <Alert
                  aria-live="polite"
                  className="border-border/40 bg-background/80 shadow-2xl shadow-background/40 backdrop-blur-xl [&>svg]:size-9 [&>svg]:translate-y-0 [&>svg]:rounded-full [&>svg]:border [&>svg]:border-primary/30 [&>svg]:bg-primary/15 [&>svg]:p-2 [&>svg]:text-primary [&>svg]:shadow-lg [&>svg]:shadow-primary/20 has-[>svg]:grid-cols-[calc(var(--spacing)*9)_1fr]"
               >
                  <Cookie strokeWidth={2.25} />
                  <AlertTitle className="font-sans">
                     Cookies no Montte
                  </AlertTitle>
                  <AlertDescription>
                     <p>
                        Usamos cookies pra entender como você usa o site e
                        melhorar o produto. Nada compartilhado com terceiros sem
                        motivo.{" "}
                        <a
                           href="/privacidade"
                           className="font-semibold text-primary underline-offset-4 hover:underline"
                        >
                           Saiba mais
                        </a>
                        .
                     </p>
                     <div className="flex w-full items-center justify-end gap-2 pt-2">
                        <Button
                           variant="ghost"
                           size="sm"
                           onClick={reject}
                           data-ph-cta="cookie_reject"
                        >
                           Recusar
                        </Button>
                        <Button
                           variant="default"
                           size="sm"
                           onClick={accept}
                           data-ph-cta="cookie_accept"
                        >
                           Aceitar
                        </Button>
                     </div>
                  </AlertDescription>
               </Alert>
            </motion.div>
         ) : null}
      </AnimatePresence>
   );
}

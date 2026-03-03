import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import { MessageCircleHeart } from "lucide-react";
import { FeatureRequestForm } from "@/features/feedback/ui/feature-request-form";
import { useCredenza } from "@/hooks/use-credenza";

export function IntegrationFeedbackCard() {
   const { openCredenza, closeCredenza } = useCredenza();

   const handleCtaClick = () => {
      openCredenza({
         children: (
            <FeatureRequestForm
               context="integration"
               onSuccess={closeCredenza}
            />
         ),
      });
   };

   return (
      <Card className="border-dashed">
         <CardHeader>
            <div className="flex items-start gap-3">
               <div className="shrink-0 pt-1">
                  <MessageCircleHeart className="size-5 text-blue-500" />
               </div>
               <div className="space-y-2 flex-1">
                  <div className="flex items-center gap-2">
                     <CardTitle className="text-base">
                        Ajude-nos a priorizar integrações
                     </CardTitle>
                     <Badge
                        className="bg-blue-500/10 text-blue-500 border-blue-500/20"
                        variant="outline"
                     >
                        Sugestão
                     </Badge>
                  </div>
                  <CardDescription>
                     Estamos construindo nosso ecossistema de integrações.
                     Diga-nos quais ferramentas fariam mais diferença na sua
                     operação.
                  </CardDescription>
               </div>
            </div>
         </CardHeader>
         <CardContent>
            <div className="space-y-3">
               <p className="text-sm text-muted-foreground">
                  Compartilhe suas necessidades e vamos priorizar as integrações
                  que mais importam para você:
               </p>
               <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                  <li>
                     Quais meios de pagamento você utiliza? (Asaas, Stripe,
                     Mercado Pago...)
                  </li>
                  <li>
                     Há alguma plataforma de e-commerce ou marketplace que
                     precisa se conectar? (Shopify, Mercado Livre...)
                  </li>
                  <li>
                     Qual integração desbloquearia mais valor na sua operação?
                  </li>
               </ul>
               <Button
                  className="mt-2"
                  onClick={handleCtaClick}
                  size="sm"
                  type="button"
                  variant="outline"
               >
                  Enviar sugestão
               </Button>
            </div>
         </CardContent>
      </Card>
   );
}

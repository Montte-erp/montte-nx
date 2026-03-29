import { FieldDescription } from "@packages/ui/components/field";

export function TermsAndPrivacyText() {
   return (
      <FieldDescription className="text-center">
         <span>Ao continuar, você concorda com nossos </span>
         <a
            className="underline text-muted-foreground hover:text-primary"
            href="https://montte.co/terms-of-service"
            rel="noopener noreferrer"
            target="_blank"
         >
            Termos de Serviço
         </a>
         <span> e </span>
         <a
            className="underline text-muted-foreground hover:text-primary"
            href="https://montte.co/privacy-policy"
            rel="noopener noreferrer"
            target="_blank"
         >
            Política de Privacidade
         </a>
         <span>.</span>
      </FieldDescription>
   );
}

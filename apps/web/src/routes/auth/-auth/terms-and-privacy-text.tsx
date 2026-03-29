import { FieldDescription } from "@packages/ui/components/field";

export function TermsAndPrivacyText() {
   const text =
      "Ao continuar, voce concorda com nossos {split} e {split}.".split(
         "{split}",
      );

   return (
      <FieldDescription className="text-center">
         <span>{text[0]}</span>
         <a
            className="underline text-muted-foreground hover:text-primary"
            href="https://montte.co/terms-of-service"
            rel="noopener noreferrer"
            target="_blank"
         >
            Termos de Servico
         </a>
         <span>{text[1]}</span>
         <a
            className="underline text-muted-foreground hover:text-primary"
            href="https://montte.co/privacy-policy"
            rel="noopener noreferrer"
            target="_blank"
         >
            Politica de Privacidade
         </a>
         <span>{text[2]}</span>
      </FieldDescription>
   );
}

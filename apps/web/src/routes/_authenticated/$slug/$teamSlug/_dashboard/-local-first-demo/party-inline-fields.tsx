import {
   InputGroup,
   InputGroupAddon,
   InputGroupInput,
} from "@packages/ui/components/input-group";
import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
} from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";
import { Mail, Phone } from "lucide-react";
import {
   useCallback,
   useEffect,
   useRef,
   useState,
   type FocusEvent,
   type KeyboardEvent,
   type ReactNode,
} from "react";
import { InlineEditText } from "@/blocks/data-table/inline-edit/inline-edit-text";

type DocumentType = "cpf" | "cnpj";

export function InlineDocumentField({
   document,
   documentType,
   onSave,
}: {
   document: string;
   documentType: DocumentType;
   onSave: (patch: {
      document?: string;
      documentType?: DocumentType;
   }) => Promise<void>;
}) {
   const [draft, setDraft] = useState(document);
   const [pending, setPending] = useState<string | null>(null);
   const lastCommittedRef = useRef(document);
   const cancelledRef = useRef(false);

   useEffect(() => {
      if (lastCommittedRef.current !== document) {
         lastCommittedRef.current = document;
         setDraft(document);
         setPending(null);
      }
   }, [document]);

   const displayed = pending ?? draft;

   const commitDocument = useCallback(
      async (next: string) => {
         const trimmed = next.trim();
         if (trimmed === document.trim()) return;
         setPending(trimmed);
         await onSave({ document: trimmed });
      },
      [document, onSave],
   );

   async function commitDocumentType(next: string) {
      await onSave({ documentType: next === "cpf" ? "cpf" : "cnpj" });
   }

   function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
      if (event.key === "Enter") {
         event.preventDefault();
         event.currentTarget.blur();
         return;
      }
      if (event.key === "Escape") {
         cancelledRef.current = true;
         setDraft(document);
         event.currentTarget.blur();
      }
   }

   function handleBlur(event: FocusEvent<HTMLInputElement>) {
      if (cancelledRef.current) {
         cancelledRef.current = false;
         return;
      }
      commitDocument(event.target.value);
   }

   return (
      <InputGroup className="h-8 border-0 bg-transparent shadow-none focus-within:ring-1 focus-within:ring-ring">
         <InputGroupAddon className="pl-1 pr-0">
            <Select onValueChange={commitDocumentType} value={documentType}>
               <SelectTrigger
                  aria-label="Tipo de documento"
                  className="h-7 w-20 border-0 bg-muted/60 px-2 shadow-none focus:ring-0"
               >
                  <SelectValue />
               </SelectTrigger>
               <SelectContent>
                  <SelectItem value="cnpj">CNPJ</SelectItem>
                  <SelectItem value="cpf">CPF</SelectItem>
               </SelectContent>
            </Select>
         </InputGroupAddon>
         <InputGroupInput
            aria-label="Documento"
            onBlur={handleBlur}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Não informado"
            value={displayed}
         />
      </InputGroup>
   );
}

export function InlineContactFields({
   email,
   emailLabel,
   onSave,
   phone,
   phoneLabel,
}: {
   email: string;
   emailLabel: string;
   onSave: (patch: { email?: string; phone?: string }) => Promise<void>;
   phone: string;
   phoneLabel: string;
}) {
   return (
      <div className="flex flex-col gap-2">
         <ContactTextField
            ariaLabel={emailLabel}
            icon={<Mail className="size-4" />}
            onSave={(value) => onSave({ email: value })}
            placeholder="E-mail"
            value={email}
         />
         <ContactTextField
            ariaLabel={phoneLabel}
            icon={<Phone className="size-4" />}
            onSave={(value) => onSave({ phone: value })}
            placeholder="Telefone"
            value={phone}
         />
      </div>
   );
}

function ContactTextField({
   ariaLabel,
   icon,
   onSave,
   placeholder,
   value,
}: {
   ariaLabel: string;
   icon: ReactNode;
   onSave: (value: string) => Promise<void>;
   placeholder: string;
   value: string;
}) {
   return (
      <InlineEditText
         ariaLabel={ariaLabel}
         className={cn(!value && "text-muted-foreground")}
         onSave={onSave}
         placeholder={placeholder}
         startContent={icon}
         value={value}
      />
   );
}

import {
   Compass,
   Lightbulb,
   Sparkles,
   Wrench,
   type LucideIcon,
} from "lucide-react";

export const TOOL_LABELS: Record<string, string> = {
   advisor_consult: "Consultando advisor sênior",
   web_search: "Pesquisando na web",
   skill_discover: "Carregando playbook",
   __lazy__tool__discovery__: "Carregando ferramentas",
   services_list: "Listando serviços",
   services_get: "Detalhando serviço",
   services_create: "Criando serviço",
   services_update: "Atualizando serviço",
   services_set_active: "Ativando ou arquivando serviços",
   services_bulk_create: "Criando serviços em lote",
   services_attach_benefit: "Vinculando benefício ao serviço",
   services_setup: "Configurando serviço completo",
   services_create_price: "Criando preço",
   prices_update: "Atualizando preço",
   prices_delete: "Removendo preço",
   meters_list: "Listando medidores",
   meters_create: "Criando medidor",
   meters_update: "Atualizando medidor",
   benefits_list: "Listando benefícios",
   benefits_create: "Criando benefício",
   coupons_list: "Listando cupons",
   coupons_create: "Criando cupom",
};

export function presentToolIcon(name: string | undefined): LucideIcon {
   if (name === "advisor_consult") return Lightbulb;
   if (name === "skill_discover") return Sparkles;
   if (name === "__lazy__tool__discovery__") return Compass;
   return Wrench;
}

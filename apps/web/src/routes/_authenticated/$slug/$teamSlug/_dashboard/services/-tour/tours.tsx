import type { TourDefinition } from "@packages/ui/components/tour";
import type { TourId } from "./store";

interface ServicesTourDefinition extends TourDefinition {
   id: TourId;
}

interface StepCopyProps {
   eyebrow?: string;
   title: string;
   body: React.ReactNode;
}

function StepCopy({ eyebrow, title, body }: StepCopyProps) {
   return (
      <div className="flex flex-col gap-2">
         {eyebrow && (
            <span className="text-muted-foreground text-[11px] font-medium uppercase tracking-wide">
               {eyebrow}
            </span>
         )}
         <p className="text-base font-semibold leading-tight">{title}</p>
         <p className="text-muted-foreground text-sm leading-relaxed">{body}</p>
      </div>
   );
}

const servicesOverviewTour: ServicesTourDefinition = {
   id: "services-overview",
   steps: [
      {
         selectorId: "tour-services-create",
         position: "left",
         padding: 12,
         content: (
            <StepCopy
               eyebrow="Passo 1 de 5"
               title="Comece criando um serviço"
               body="Cadastre o que você vende. Pode ser uma assinatura, hora de trabalho, espaço alugado ou consumo medido — qualquer coisa cobrada."
            />
         ),
      },
      {
         selectorId: "tour-nav-item-meters",
         position: "right",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Passo 2 — Medidores"
               title="Conte o que o cliente consome"
               body="Medidores capturam eventos (horas, GB, mensagens, dias). Servem para preços por consumo, créditos de benefícios e cupons baseados em uso."
            />
         ),
      },
      {
         selectorId: "tour-nav-item-benefits",
         position: "right",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Passo 3 — Benefícios"
               title="Empacote vantagens junto"
               body="Perks (vantagens fixas, ex.: acesso 24h) ou Créditos (saldo de consumo, ex.: 10h grátis). Anexe a um ou vários serviços."
            />
         ),
      },
      {
         selectorId: "tour-nav-item-coupons",
         position: "right",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Passo 4 — Cupons"
               title="Ajuste preço por contexto"
               body="Descontos ou acréscimos automáticos. Por código, por dia da semana, por cliente, por consumo — você define o gatilho e o escopo."
            />
         ),
      },
      {
         selectorId: "tour-services-tabs",
         position: "bottom",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Pronto"
               title="Catálogo organizado"
               body="Use as abas para alternar entre todos, ativos ou arquivados. O ícone ? no header reabre este tour quando precisar."
            />
         ),
      },
   ],
};

const serviceDetailTour: ServicesTourDefinition = {
   id: "service-detail",
   steps: [
      {
         selectorId: "tour-service-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="Página do serviço"
               title="Tudo sobre um serviço em um lugar"
               body="Aqui você ajusta preço, anexa benefícios, vê assinantes e acompanha a saúde. As 4 abas abaixo organizam isso."
            />
         ),
      },
      {
         selectorId: "tour-service-tab-precos",
         position: "bottom",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Aba 1 — Preços"
               title="Como você cobra"
               body="Defina valor fixo (assinatura), por consumo (medidor) ou ambos. Pode ter mais de um preço ativo — ex.: mensal e anual."
            />
         ),
      },
      {
         selectorId: "tour-service-tab-beneficios",
         position: "bottom",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Aba 2 — Benefícios"
               title="O que vai junto"
               body="Anexe perks e créditos. O custo desses benefícios entra no cálculo da margem efetiva do serviço."
            />
         ),
      },
      {
         selectorId: "tour-service-tab-assinantes",
         position: "bottom",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Aba 3 — Assinantes"
               title="Quem está usando"
               body="Lista de clientes ativos no serviço, com período, status e consumo. Bom para investigar churn ou inadimplência."
            />
         ),
      },
      {
         selectorId: "tour-service-tab-overview",
         position: "bottom",
         padding: 6,
         content: (
            <StepCopy
               eyebrow="Aba 4 — Overview"
               title="Saúde do serviço"
               body="MRR, número de assinantes, consumo agregado e margem. Aqui você decide se ajusta preço, benefício ou aposenta o serviço."
            />
         ),
      },
   ],
};

const metersIntroTour: ServicesTourDefinition = {
   id: "meters-intro",
   steps: [
      {
         selectorId: "tour-meters-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="O que é um medidor"
               title="Conta unidades consumidas"
               body="Cada medidor tem um nome de evento (ex.: hora_de_sala) e uma agregação (somar, contar, último valor). No fim do período vira cobrança."
            />
         ),
      },
      {
         selectorId: "tour-meters-create",
         position: "left",
         padding: 12,
         content: (
            <StepCopy
               eyebrow="Criar medidor"
               title="Comece pelo básico"
               body="Dê um nome humano (Horas de Coworking) e o evento técnico vira slug. Defina o custo por unidade — ex.: R$ 12,00 por hora."
            />
         ),
      },
      {
         selectorId: "tour-meters-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="Onde se conecta"
               title="Medidor é a base do uso"
               body={
                  <>
                     Mesmo medidor pode alimentar três coisas:
                     <ul className="mt-2 flex list-disc flex-col gap-1 pl-4">
                        <li>Preço por consumo do serviço</li>
                        <li>Saldo de crédito de um benefício</li>
                        <li>Gatilho de cupom (ex.: a cada 100h, -10%)</li>
                     </ul>
                  </>
               }
            />
         ),
      },
   ],
};

const benefitsIntroTour: ServicesTourDefinition = {
   id: "benefits-intro",
   steps: [
      {
         selectorId: "tour-benefits-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="Dois tipos"
               title="Perk vs Crédito"
               body={
                  <>
                     <strong className="text-foreground">Perk</strong> é
                     vantagem fixa (acesso ao lounge, café incluso).{" "}
                     <strong className="text-foreground">Crédito</strong> é
                     saldo de consumo vinculado a um medidor (10h de sala
                     grátis/mês).
                  </>
               }
            />
         ),
      },
      {
         selectorId: "tour-benefits-create",
         position: "left",
         padding: 12,
         content: (
            <StepCopy
               eyebrow="Criar benefício"
               title="Defina o tipo e o custo"
               body="Crédito precisa de medidor + quantidade por período. Perk é só descrição + custo estimado. O custo entra na margem do serviço onde for anexado."
            />
         ),
      },
      {
         selectorId: "tour-benefits-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="Reaproveite"
               title="Um benefício, vários serviços"
               body="O mesmo benefício pode ser anexado a múltiplos serviços. Mudou o custo? Atualiza num lugar e recalcula a margem em todos."
            />
         ),
      },
   ],
};

const couponsIntroTour: ServicesTourDefinition = {
   id: "coupons-intro",
   steps: [
      {
         selectorId: "tour-coupons-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="Três eixos"
               title="Direção, gatilho, escopo"
               body={
                  <>
                     <strong className="text-foreground">Direção:</strong>{" "}
                     desconto ou acréscimo.{" "}
                     <strong className="text-foreground">Gatilho:</strong>{" "}
                     automático ou por código.{" "}
                     <strong className="text-foreground">Escopo:</strong> um
                     preço, um medidor ou um cliente específico.
                  </>
               }
            />
         ),
      },
      {
         selectorId: "tour-coupons-create",
         position: "left",
         padding: 12,
         content: (
            <StepCopy
               eyebrow="Criar cupom"
               title="Combine os 3 eixos"
               body={
                  <>
                     Exemplo: <em>surcharge</em> automático de +40% no medidor{" "}
                     <code className="bg-muted rounded px-1">hora_de_sala</code>{" "}
                     quando for sábado. Ou: -20% por código{" "}
                     <code className="bg-muted rounded px-1">FIDELIDADE</code>{" "}
                     no Plano Anual.
                  </>
               }
            />
         ),
      },
      {
         selectorId: "tour-coupons-header",
         position: "bottom",
         padding: 8,
         content: (
            <StepCopy
               eyebrow="Boas práticas"
               title="Cupom não substitui preço"
               body="Use cupom para variações pontuais (promo, fim de semana, fidelidade). Para preços base diferentes — ex.: mensal vs anual — crie preços separados no serviço."
            />
         ),
      },
   ],
};

export const servicesTours: ServicesTourDefinition[] = [
   servicesOverviewTour,
   serviceDetailTour,
   metersIntroTour,
   benefitsIntroTour,
   couponsIntroTour,
];

import { TabsList, TabsTrigger } from "@packages/ui/components/tabs";

export function ServiceTabsList() {
   return (
      <TabsList>
         <TabsTrigger id="tour-service-tab-precos" value="precos">
            Preços
         </TabsTrigger>
         <TabsTrigger id="tour-service-tab-beneficios" value="beneficios">
            Benefícios
         </TabsTrigger>
         <TabsTrigger id="tour-service-tab-assinantes" value="assinantes">
            Assinantes
         </TabsTrigger>
         <TabsTrigger id="tour-service-tab-overview" value="overview">
            Overview
         </TabsTrigger>
      </TabsList>
   );
}

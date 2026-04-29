import { TabsList, TabsTrigger } from "@packages/ui/components/tabs";

export function ServiceTabsList() {
   return (
      <TabsList>
         <TabsTrigger value="precos">Preços</TabsTrigger>
         <TabsTrigger value="beneficios">Benefícios</TabsTrigger>
         <TabsTrigger value="assinantes">Assinantes</TabsTrigger>
         <TabsTrigger value="overview">Overview</TabsTrigger>
      </TabsList>
   );
}

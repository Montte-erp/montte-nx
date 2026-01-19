import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
} from "@packages/ui/components/dialog";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import {
   ChevronRightIcon,
   CrownIcon,
   ShieldIcon,
   UserIcon,
} from "lucide-react";
import * as React from "react";

const roleData = {
   owner: {
      description:
         "O usuário que criou a organização. Tem controle total sobre a organização e pode executar qualquer ação.",
      permissions: [
         "Organização: atualizar, excluir",
         "Membro: criar, atualizar, excluir",
         "Convite: criar, cancelar",
         "Transferir propriedade",
         "Controle total sobre todos os recursos",
      ],
      title: "Dono",
   },
   admin: {
      description:
         "Controle total sobre a organização, exceto excluir a organização ou alterar o dono.",
      permissions: [
         "Organização: atualizar",
         "Membro: criar, atualizar, excluir",
         "Convite: criar, cancelar",
         "Não pode excluir organização",
         "Não pode alterar dono",
      ],
      title: "Administrador",
   },
   member: {
      description:
         "Controle limitado sobre a organização. Pode criar projetos, convidar usuários e gerenciar projetos que criou.",
      permissions: [
         "Ler dados da organização",
         "Criar projetos",
         "Convidar usuários",
         "Gerenciar próprios projetos",
         "Sem controle sobre ações de organização/membro/convite",
      ],
      title: "Membro",
   },
};

export function OrganizationRoles() {
   const organizationRoles = [
      {
         icon: CrownIcon,
         id: "owner" as const,
      },
      {
         icon: ShieldIcon,
         id: "admin" as const,
      },
      {
         icon: UserIcon,
         id: "member" as const,
      },
   ];

   function RolePermissionsDialog({
      role,
   }: {
      role: (typeof organizationRoles)[0];
   }) {
      const localizedRole = roleData[role.id];

      return (
         <DialogContent>
            <DialogHeader>
               <DialogTitle className="flex items-center gap-3">
                  Permissões
               </DialogTitle>
               <DialogDescription>
                  Permissões e capacidades detalhadas para este cargo
               </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
               <p className="text-sm text-muted-foreground">
                  {localizedRole.description}
               </p>
               <div>
                  <p className="text-sm font-medium mb-3">Permissões:</p>
                  <ul className="text-sm space-y-2">
                     {localizedRole.permissions.map((permission, index) => (
                        <li
                           className="flex items-start gap-3"
                           key={`permission-${index + 1}`}
                        >
                           <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                           <span>{permission}</span>
                        </li>
                     ))}
                  </ul>
               </div>
            </div>
         </DialogContent>
      );
   }
   return (
      <Card className="w-full">
         <CardHeader>
            <CardTitle>Cargos da Organização</CardTitle>
            <CardDescription>
               Cargos e permissões de controle de acesso para gestão da
               organização
            </CardDescription>
         </CardHeader>
         <CardContent className="w-full">
            <ItemGroup>
               {organizationRoles.map((role, index) => {
                  const localizedRole = roleData[role.id];
                  return (
                     <React.Fragment key={role.id}>
                        <Dialog>
                           <DialogTrigger asChild>
                              <Item className="cursor-pointer hover:bg-accent/50 transition-colors">
                                 <ItemMedia className="size-10 " variant="icon">
                                    <role.icon className="size-4 " />
                                 </ItemMedia>
                                 <ItemContent className="gap-1">
                                    <ItemTitle>{localizedRole.title}</ItemTitle>
                                    <ItemDescription>
                                       {localizedRole.description}
                                    </ItemDescription>
                                 </ItemContent>
                                 <ItemActions>
                                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                                 </ItemActions>
                              </Item>
                           </DialogTrigger>
                           <RolePermissionsDialog role={role} />
                        </Dialog>
                        {index !== organizationRoles.length - 1 && (
                           <ItemSeparator />
                        )}
                     </React.Fragment>
                  );
               })}
            </ItemGroup>
         </CardContent>
      </Card>
   );
}

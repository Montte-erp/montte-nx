export declare const PERMISSIONS: {
   readonly CONTENT_VIEW: "content:view";
   readonly CONTENT_CREATE: "content:create";
   readonly CONTENT_EDIT: "content:edit";
   readonly CONTENT_DELETE: "content:delete";
   readonly CONTENT_PUBLISH: "content:publish";
   readonly FORM_VIEW: "form:view";
   readonly FORM_CREATE: "form:create";
   readonly FORM_EDIT: "form:edit";
   readonly FORM_DELETE: "form:delete";
   readonly DASHBOARD_VIEW: "dashboard:view";
   readonly DASHBOARD_CREATE: "dashboard:create";
   readonly DASHBOARD_EDIT: "dashboard:edit";
   readonly DASHBOARD_DELETE: "dashboard:delete";
   readonly INSIGHT_VIEW: "insight:view";
   readonly INSIGHT_CREATE: "insight:create";
   readonly INSIGHT_EDIT: "insight:edit";
   readonly INSIGHT_DELETE: "insight:delete";
   readonly TEAM_MANAGE: "team:manage";
   readonly TEAM_SETTINGS: "team:settings";
   readonly INTEGRATION_VIEW: "integration:view";
   readonly INTEGRATION_MANAGE: "integration:manage";
};
export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
export declare const PERMISSION_GROUPS: readonly [
   {
      readonly id: "content";
      readonly label: "Conteúdo";
      readonly permissions: readonly [
         {
            readonly id: "content:view";
            readonly label: "Visualizar";
         },
         {
            readonly id: "content:create";
            readonly label: "Criar";
         },
         {
            readonly id: "content:edit";
            readonly label: "Editar";
         },
         {
            readonly id: "content:delete";
            readonly label: "Deletar";
         },
         {
            readonly id: "content:publish";
            readonly label: "Publicar";
         },
      ];
   },
   {
      readonly id: "forms";
      readonly label: "Formulários";
      readonly permissions: readonly [
         {
            readonly id: "form:view";
            readonly label: "Visualizar";
         },
         {
            readonly id: "form:create";
            readonly label: "Criar";
         },
         {
            readonly id: "form:edit";
            readonly label: "Editar";
         },
         {
            readonly id: "form:delete";
            readonly label: "Deletar";
         },
      ];
   },
   {
      readonly id: "dashboards";
      readonly label: "Dashboards";
      readonly permissions: readonly [
         {
            readonly id: "dashboard:view";
            readonly label: "Visualizar";
         },
         {
            readonly id: "dashboard:create";
            readonly label: "Criar";
         },
         {
            readonly id: "dashboard:edit";
            readonly label: "Editar";
         },
         {
            readonly id: "dashboard:delete";
            readonly label: "Deletar";
         },
      ];
   },
   {
      readonly id: "insights";
      readonly label: "Insights";
      readonly permissions: readonly [
         {
            readonly id: "insight:view";
            readonly label: "Visualizar";
         },
         {
            readonly id: "insight:create";
            readonly label: "Criar";
         },
         {
            readonly id: "insight:edit";
            readonly label: "Editar";
         },
         {
            readonly id: "insight:delete";
            readonly label: "Deletar";
         },
      ];
   },
   {
      readonly id: "team";
      readonly label: "Equipe";
      readonly permissions: readonly [
         {
            readonly id: "team:manage";
            readonly label: "Gerenciar membros";
         },
         {
            readonly id: "team:settings";
            readonly label: "Configurações";
         },
      ];
   },
   {
      readonly id: "integrations";
      readonly label: "Integrações";
      readonly permissions: readonly [
         {
            readonly id: "integration:view";
            readonly label: "Visualizar";
         },
         {
            readonly id: "integration:manage";
            readonly label: "Gerenciar";
         },
      ];
   },
];
//# sourceMappingURL=permissions.d.ts.map

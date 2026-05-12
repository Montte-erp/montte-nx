export const PERMISSIONS = {
   // Content permissions
   CONTENT_VIEW: "content:view",
   CONTENT_CREATE: "content:create",
   CONTENT_EDIT: "content:edit",
   CONTENT_DELETE: "content:delete",
   CONTENT_PUBLISH: "content:publish",

   // Form permissions
   FORM_VIEW: "form:view",
   FORM_CREATE: "form:create",
   FORM_EDIT: "form:edit",
   FORM_DELETE: "form:delete",

   // Team permissions
   TEAM_MANAGE: "team:manage",
   TEAM_SETTINGS: "team:settings",

   // Integration permissions
   INTEGRATION_VIEW: "integration:view",
   INTEGRATION_MANAGE: "integration:manage",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_GROUPS = [
   {
      id: "content",
      label: "Conteúdo",
      permissions: [
         { id: PERMISSIONS.CONTENT_VIEW, label: "Visualizar" },
         { id: PERMISSIONS.CONTENT_CREATE, label: "Criar" },
         { id: PERMISSIONS.CONTENT_EDIT, label: "Editar" },
         { id: PERMISSIONS.CONTENT_DELETE, label: "Deletar" },
         { id: PERMISSIONS.CONTENT_PUBLISH, label: "Publicar" },
      ],
   },
   {
      id: "forms",
      label: "Formulários",
      permissions: [
         { id: PERMISSIONS.FORM_VIEW, label: "Visualizar" },
         { id: PERMISSIONS.FORM_CREATE, label: "Criar" },
         { id: PERMISSIONS.FORM_EDIT, label: "Editar" },
         { id: PERMISSIONS.FORM_DELETE, label: "Deletar" },
      ],
   },
   {
      id: "team",
      label: "Equipe",
      permissions: [
         { id: PERMISSIONS.TEAM_MANAGE, label: "Gerenciar membros" },
         { id: PERMISSIONS.TEAM_SETTINGS, label: "Configurações" },
      ],
   },
   {
      id: "integrations",
      label: "Integrações",
      permissions: [
         { id: PERMISSIONS.INTEGRATION_VIEW, label: "Visualizar" },
         { id: PERMISSIONS.INTEGRATION_MANAGE, label: "Gerenciar" },
      ],
   },
] as const;

export const VAULT_DEFAULT_FOLDER_KEYS = {
   attachments: "attachments",
   fiscal: "fiscal",
   contracts: "contracts",
   company: "company",
} as const;

export type VaultDefaultFolderKey =
   (typeof VAULT_DEFAULT_FOLDER_KEYS)[keyof typeof VAULT_DEFAULT_FOLDER_KEYS];

export const vaultDefaultFolders: {
   key: VaultDefaultFolderKey;
   name: string;
}[] = [
   { key: VAULT_DEFAULT_FOLDER_KEYS.attachments, name: "Anexos" },
   { key: VAULT_DEFAULT_FOLDER_KEYS.fiscal, name: "Fiscal" },
   { key: VAULT_DEFAULT_FOLDER_KEYS.contracts, name: "Contratos" },
   { key: VAULT_DEFAULT_FOLDER_KEYS.company, name: "Empresa" },
];

export const vaultDocumentStatusEnum = [
   "draft",
   "stored",
   "archived",
   "needs_review",
] as const;
export type VaultDocumentStatus = (typeof vaultDocumentStatusEnum)[number];

export const vaultDocumentSourceEnum = [
   "manual",
   "fiscal",
   "contracts",
   "finance",
] as const;
export type VaultDocumentSource = (typeof vaultDocumentSourceEnum)[number];

export const vaultStatusLabels: Record<VaultDocumentStatus, string> = {
   draft: "Rascunho",
   stored: "Armazenado",
   archived: "Arquivado",
   needs_review: "Revisar",
};

export const vaultSourceLabels: Record<VaultDocumentSource, string> = {
   manual: "Manual",
   fiscal: "Fiscal",
   contracts: "Contratos",
   finance: "Financeiro",
};

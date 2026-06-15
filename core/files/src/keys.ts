export const FILE_KEYS = {
   organizationLogos: "organization-logos",
   userAvatars: "user-avatars",
   vaultDocuments: "vault-documents",
} as const;

export type FileKeyPrefix = (typeof FILE_KEYS)[keyof typeof FILE_KEYS];

export function buildFileKey(prefix: FileKeyPrefix, name: string): string {
   return `${prefix}/${name}`;
}

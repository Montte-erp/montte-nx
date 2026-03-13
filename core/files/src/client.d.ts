import { Client } from "minio";
export type MinioClient = Client;
export declare function createMinioClient(opts: {
   endpoint: string;
   accessKey?: string;
   secretKey?: string;
}): Client;
export declare function uploadFile(
   client: Client,
   fileName: string,
   fileBuffer: Buffer,
   contentType: string,
   bucketName: string,
): Promise<string>;
export declare function getFile(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<NodeJS.ReadableStream>;
export declare function listFiles(
   client: Client,
   bucketName: string,
   prefix: string,
): Promise<string[]>;
export declare function streamFileForProxy(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<{
   buffer: Buffer;
   contentType: string;
}>;
export declare function getFileInfo(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<{
   size: number;
   contentType: string;
}>;
export declare function generatePresignedPutUrl(
   client: Client,
   fileName: string,
   bucketName: string,
   expirySeconds?: number,
): Promise<string>;
export declare function generatePresignedGetUrl(
   client: Client,
   fileName: string,
   bucketName: string,
   expirySeconds?: number,
): Promise<string>;
export declare function verifyFileExists(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<{
   exists: boolean;
   size: number;
   contentType: string;
} | null>;
export declare function deleteFile(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<void>;
//# sourceMappingURL=client.d.ts.map

import { custom } from "@better-upload/server/clients";
import {
   deleteObject as deleteObjectHelper,
   getObjectBlob,
   getObjectStream,
   headObject,
   listObjectsV2,
   presignGetObject,
   putObject as putObjectHelper,
} from "@better-upload/server/helpers";

export type S3Client = ReturnType<typeof custom>;

export type ParsedEndpoint = {
   host: string;
   hostname: string;
   port: number;
   useSSL: boolean;
};

export function parseEndpoint(endpoint: string): ParsedEndpoint {
   const url = new URL(
      endpoint.startsWith("http") ? endpoint : `http://${endpoint}`,
   );
   const useSSL = url.protocol === "https:";
   const port = url.port ? Number(url.port) : useSSL ? 443 : 9000;
   return {
      host: `${url.hostname}:${port}`,
      hostname: url.hostname,
      port,
      useSSL,
   };
}

export function createS3Client(opts: {
   endpointUrl: string;
   accessKeyId: string;
   secretAccessKey: string;
   region?: string;
}): S3Client {
   const { host, useSSL } = parseEndpoint(opts.endpointUrl);
   return custom({
      host,
      accessKeyId: opts.accessKeyId,
      secretAccessKey: opts.secretAccessKey,
      region: opts.region ?? "us-east-1",
      secure: useSSL,
      forcePathStyle: false,
   });
}

export async function uploadFile(
   client: S3Client,
   fileName: string,
   fileBuffer: Buffer | Uint8Array,
   contentType: string,
   bucketName: string,
): Promise<string> {
   await putObjectHelper(client, {
      bucket: bucketName,
      key: fileName,
      body: fileBuffer,
      contentType,
      contentLength: fileBuffer.byteLength,
   });
   return fileName;
}

export async function getFile(
   client: S3Client,
   fileName: string,
   bucketName: string,
): Promise<ReadableStream<Uint8Array>> {
   const result = await getObjectStream(client, {
      bucket: bucketName,
      key: fileName,
   });
   return result.stream;
}

export async function listFiles(
   client: S3Client,
   bucketName: string,
   prefix: string,
): Promise<string[]> {
   const files: string[] = [];
   let continuationToken: string | undefined;
   do {
      const page = await listObjectsV2(client, {
         bucket: bucketName,
         prefix,
         continuationToken,
      });
      for (const obj of page.contents) {
         files.push(obj.key.replace(prefix, ""));
      }
      continuationToken = page.isTruncated
         ? page.nextContinuationToken
         : undefined;
   } while (continuationToken);
   return files;
}

export async function streamFileForProxy(
   client: S3Client,
   fileName: string,
   bucketName: string,
): Promise<{ buffer: Buffer; contentType: string }> {
   const result = await getObjectBlob(client, {
      bucket: bucketName,
      key: fileName,
   });
   const arrayBuffer = await result.blob.arrayBuffer();
   return {
      buffer: Buffer.from(arrayBuffer),
      contentType: result.contentType || "application/octet-stream",
   };
}

export async function getFileInfo(
   client: S3Client,
   fileName: string,
   bucketName: string,
): Promise<{ size: number; contentType: string }> {
   const stat = await headObject(client, { bucket: bucketName, key: fileName });
   return { contentType: stat.contentType, size: stat.contentLength };
}

export async function generatePresignedPutUrl(
   client: S3Client,
   fileName: string,
   bucketName: string,
   expirySeconds = 300,
): Promise<string> {
   const url = `${client.buildBucketUrl(bucketName)}/${encodeURI(fileName)}?X-Amz-Expires=${expirySeconds}`;
   const signed = await client.s3.sign(url, {
      method: "PUT",
      aws: { signQuery: true },
   });
   return signed.url.toString();
}

export async function generatePresignedGetUrl(
   client: S3Client,
   fileName: string,
   bucketName: string,
   expirySeconds = 3600,
): Promise<string> {
   return presignGetObject(client, {
      bucket: bucketName,
      key: fileName,
      expiresIn: expirySeconds,
   });
}

export async function verifyFileExists(
   client: S3Client,
   fileName: string,
   bucketName: string,
): Promise<{ exists: boolean; size: number; contentType: string } | null> {
   const stat = await headObject(client, {
      bucket: bucketName,
      key: fileName,
   }).catch(() => null);
   if (!stat) return null;
   return {
      contentType: stat.contentType || "application/octet-stream",
      exists: true,
      size: stat.contentLength,
   };
}

export async function deleteFile(
   client: S3Client,
   fileName: string,
   bucketName: string,
): Promise<void> {
   await deleteObjectHelper(client, { bucket: bucketName, key: fileName });
}

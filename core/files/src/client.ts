import { getLogger } from "@core/logging/root";
import { Client } from "minio";

const logger = getLogger().child({ module: "files" });

const parseEndpoint = (endpointUrl: string) => {
   const fullUrl = endpointUrl.startsWith("http")
      ? endpointUrl
      : `http://${endpointUrl}`;

   try {
      const url = new URL(fullUrl);
      const useSSL = url.protocol === "https:";
      const port = url.port ? parseInt(url.port, 10) : useSSL ? 443 : 9000;

      return {
         endPoint: url.hostname,
         port,
         useSSL,
      };
   } catch (error) {
      logger.error(
         { err: error, endpointUrl },
         "Invalid endpoint URL provided",
      );
      return {
         endPoint: "localhost",
         port: 9000,
         useSSL: false,
      };
   }
};

export type MinioClient = Client;

export function createMinioClient(opts: {
   endpoint: string;
   accessKey?: string;
   secretKey?: string;
}): Client {
   const { endPoint, port, useSSL } = parseEndpoint(opts.endpoint);
   return new Client({
      accessKey: opts.accessKey,
      endPoint,
      port,
      secretKey: opts.secretKey,
      useSSL,
   });
}

export async function uploadFile(
   client: Client,
   fileName: string,
   fileBuffer: Buffer,
   contentType: string,
   bucketName: string,
): Promise<string> {
   const bucketExists = await client.bucketExists(bucketName);
   if (!bucketExists) {
      await client.makeBucket(bucketName);
   }
   await client.putObject(bucketName, fileName, fileBuffer, fileBuffer.length, {
      "Content-Type": contentType,
   });
   return fileName;
}

export async function getFile(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<NodeJS.ReadableStream> {
   const stream = await client.getObject(bucketName, fileName);
   return stream;
}

export async function listFiles(
   client: Client,
   bucketName: string,
   prefix: string,
): Promise<string[]> {
   const files: string[] = [];
   const stream = client.listObjectsV2(bucketName, prefix, true);
   for await (const obj of stream) {
      if (obj.name) files.push(obj.name.replace(prefix, ""));
   }
   return files;
}

export async function streamFileForProxy(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<{ buffer: Buffer; contentType: string }> {
   const stream = await client.getObject(bucketName, fileName);
   const chunks: Buffer[] = [];
   for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
   }
   const buffer = Buffer.concat(chunks);
   let contentType = "image/jpeg";
   try {
      const stat = await client.statObject(bucketName, fileName);
      if (stat.metaData?.["content-type"]) {
         contentType = stat.metaData["content-type"];
      }
   } catch (err) {
      logger.error({ err }, "Error fetching file metadata");
   }
   return { buffer, contentType };
}

export async function getFileInfo(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<{ size: number; contentType: string }> {
   const stat = await client.statObject(bucketName, fileName);
   return { contentType: stat.metaData["content-type"], size: stat.size };
}

export async function generatePresignedPutUrl(
   client: Client,
   fileName: string,
   bucketName: string,
   expirySeconds = 300,
): Promise<string> {
   const bucketExists = await client.bucketExists(bucketName);
   if (!bucketExists) {
      await client.makeBucket(bucketName);
   }
   return client.presignedPutObject(bucketName, fileName, expirySeconds);
}

export async function generatePresignedGetUrl(
   client: Client,
   fileName: string,
   bucketName: string,
   expirySeconds = 3600,
): Promise<string> {
   return client.presignedGetObject(bucketName, fileName, expirySeconds);
}

export async function verifyFileExists(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<{ exists: boolean; size: number; contentType: string } | null> {
   try {
      const stat = await client.statObject(bucketName, fileName);
      return {
         contentType:
            stat.metaData?.["content-type"] ?? "application/octet-stream",
         exists: true,
         size: stat.size,
      };
   } catch {
      return null;
   }
}

export async function deleteFile(
   client: Client,
   fileName: string,
   bucketName: string,
): Promise<void> {
   await client.removeObject(bucketName, fileName);
}

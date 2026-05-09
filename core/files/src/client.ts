import { custom } from "@better-upload/server/clients";

export type S3Client = ReturnType<typeof custom>;

function parseEndpoint(endpoint: string) {
   const url = new URL(
      endpoint.startsWith("http") ? endpoint : `http://${endpoint}`,
   );
   const useSSL = url.protocol === "https:";
   const port = url.port ? Number(url.port) : useSSL ? 443 : 9000;
   return { host: `${url.hostname}:${port}`, useSSL };
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

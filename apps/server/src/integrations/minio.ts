import { env } from "@core/environment/server";
import { getMinioClient } from "@packages/files/client";

export const minioClient = getMinioClient(env);

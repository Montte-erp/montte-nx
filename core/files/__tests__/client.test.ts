import { beforeEach, describe, expect, it, vi } from "vitest";

const { loggerErrorMock, minioClientMock } = vi.hoisted(() => ({
   loggerErrorMock: vi.fn(),
   minioClientMock: {
      bucketExists: vi.fn(),
      getObject: vi.fn(),
      listObjectsV2: vi.fn(),
      makeBucket: vi.fn(),
      presignedGetObject: vi.fn(),
      presignedPutObject: vi.fn(),
      putObject: vi.fn(),
      removeObject: vi.fn(),
      statObject: vi.fn(),
   },
}));

vi.mock("@core/logging/root", () => ({
   getLogger: () => ({
      child: () => ({
         error: loggerErrorMock,
      }),
   }),
}));

vi.mock("minio", () => ({
   Client: vi.fn(function MockMinioClient() {
      return minioClientMock;
   }),
}));

import { createMinioClient, uploadFile, verifyFileExists } from "../src/client";

describe("files client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("creates the bucket before uploading when it does not exist", async () => {
      minioClientMock.bucketExists.mockResolvedValueOnce(false);
      minioClientMock.makeBucket.mockResolvedValueOnce(undefined);
      minioClientMock.putObject.mockResolvedValueOnce(undefined);

      const client = createMinioClient({
         endpoint: "https://minio.example.com",
         accessKey: "access-key",
         secretKey: "secret-key",
      });
      const fileBuffer = Buffer.from("hello world");

      const result = await uploadFile(
         client,
         "note.md",
         fileBuffer,
         "text/markdown",
         "content-bucket",
      );

      expect(result).toBe("note.md");
      expect(minioClientMock.bucketExists).toHaveBeenCalledWith(
         "content-bucket",
      );
      expect(minioClientMock.makeBucket).toHaveBeenCalledWith("content-bucket");
      expect(minioClientMock.putObject).toHaveBeenCalledWith(
         "content-bucket",
         "note.md",
         fileBuffer,
         fileBuffer.length,
         {
            "Content-Type": "text/markdown",
         },
      );
   });

   it("returns null when a file does not exist", async () => {
      minioClientMock.statObject.mockRejectedValueOnce(new Error("missing"));

      const client = createMinioClient({
         endpoint: "https://minio.example.com",
         accessKey: "access-key",
         secretKey: "secret-key",
      });

      await expect(
         verifyFileExists(client, "missing.md", "content-bucket"),
      ).resolves.toBeNull();
   });
});

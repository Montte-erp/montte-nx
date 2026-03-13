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

vi.mock("@core/environment/web/server", () => ({
   env: {
      MINIO_ACCESS_KEY: "access-key",
      MINIO_ENDPOINT: "https://minio.example.com",
      MINIO_SECRET_KEY: "secret-key",
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

describe("files client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
      vi.resetModules();
   });

   it("creates the bucket before uploading when it does not exist", async () => {
      minioClientMock.bucketExists.mockResolvedValueOnce(false);
      minioClientMock.makeBucket.mockResolvedValueOnce(undefined);
      minioClientMock.putObject.mockResolvedValueOnce(undefined);

      const { uploadFile } = await import("../src/client");
      const fileBuffer = Buffer.from("hello world");

      const result = await uploadFile(
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

      const { verifyFileExists } = await import("../src/client");

      await expect(
         verifyFileExists("missing.md", "content-bucket"),
      ).resolves.toBeNull();
   });
});

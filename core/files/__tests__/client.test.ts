import { beforeEach, describe, expect, it, vi } from "vitest";

const { putObjectMock, headObjectMock, customMock } = vi.hoisted(() => ({
   putObjectMock: vi.fn(),
   headObjectMock: vi.fn(),
   customMock: vi.fn(() => ({
      buildBucketUrl: (b: string) => `https://${b}.example.com`,
      s3: {},
   })),
}));

vi.mock("@better-upload/server/clients", () => ({ custom: customMock }));
vi.mock("@better-upload/server/helpers", () => ({
   putObject: putObjectMock,
   headObject: headObjectMock,
   getObjectStream: vi.fn(),
   getObjectBlob: vi.fn(),
   listObjectsV2: vi.fn(),
   deleteObject: vi.fn(),
   presignGetObject: vi.fn(),
}));

import { createS3Client, uploadFile, verifyFileExists } from "../src/client";

describe("files client", () => {
   beforeEach(() => {
      vi.clearAllMocks();
   });

   it("calls putObject when uploading a file", async () => {
      putObjectMock.mockResolvedValueOnce(undefined);
      const client = createS3Client({
         endpoint: "https://s3.example.com",
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
      expect(putObjectMock).toHaveBeenCalledWith(client, {
         bucket: "content-bucket",
         key: "note.md",
         body: fileBuffer,
         contentType: "text/markdown",
         contentLength: fileBuffer.byteLength,
      });
   });

   it("returns null when a file does not exist", async () => {
      headObjectMock.mockRejectedValueOnce(new Error("missing"));
      const client = createS3Client({
         endpoint: "https://s3.example.com",
         accessKey: "access-key",
         secretKey: "secret-key",
      });

      await expect(
         verifyFileExists(client, "missing.md", "content-bucket"),
      ).resolves.toBeNull();
   });
});

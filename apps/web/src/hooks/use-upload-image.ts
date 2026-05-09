import { useUploadFile } from "@better-upload/client";
import imageCompression from "browser-image-compression";

type UseUploadFileOptions = Parameters<typeof useUploadFile>[0];

export type UseUploadImageOptions = Omit<
   UseUploadFileOptions,
   "onBeforeUpload"
> & {
   compression?: {
      maxSizeMB?: number;
      maxWidthOrHeight?: number;
   };
};

export function useUploadImage({
   compression,
   ...options
}: UseUploadImageOptions) {
   return useUploadFile({
      ...options,
      onBeforeUpload: ({ file }) =>
         imageCompression(file, {
            maxSizeMB: compression?.maxSizeMB ?? 0.5,
            maxWidthOrHeight: compression?.maxWidthOrHeight ?? 1024,
            useWebWorker: true,
         }),
   });
}

import { createClientOnlyFn } from "@tanstack/react-start";
import { useThrottledCallback } from "@tanstack/react-pacer";

const triggerDownload = createClientOnlyFn((blob: Blob, filename: string) => {
   const url = URL.createObjectURL(blob);
   const a = document.createElement("a");
   a.href = url;
   a.download = filename;
   a.click();
   URL.revokeObjectURL(url);
});

export function useFileDownload() {
   const download = useThrottledCallback(
      (blob: Blob, filename: string) => triggerDownload(blob, filename),
      { wait: 1000 },
   );

   return { download };
}

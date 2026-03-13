import type { ReactNode } from "react";
import type { DropEvent, DropzoneOptions, FileRejection } from "react-dropzone";
export type DropzoneProps = Omit<DropzoneOptions, "onDrop"> & {
   src?: File[];
   className?: string;
   onDrop?: (
      acceptedFiles: File[],
      fileRejections: FileRejection[],
      event: DropEvent,
   ) => void;
   children?: ReactNode;
};
export declare const Dropzone: ({
   accept,
   maxFiles,
   maxSize,
   minSize,
   onDrop,
   onError,
   disabled,
   src,
   className,
   children,
   ...props
}: DropzoneProps) => import("react/jsx-runtime").JSX.Element;
export type DropzoneContentProps = {
   children?: ReactNode;
   className?: string;
};
export declare const DropzoneContent: ({
   children,
   className,
}: DropzoneContentProps) =>
   | string
   | number
   | bigint
   | true
   | import("react/jsx-runtime").JSX.Element
   | Iterable<ReactNode>
   | Promise<
        | string
        | number
        | bigint
        | boolean
        | Iterable<ReactNode>
        | import("react").ReactElement<
             unknown,
             string | import("react").JSXElementConstructor<any>
          >
        | import("react").ReactPortal
        | null
        | undefined
     >
   | null;
export type DropzoneEmptyStateProps = {
   children?: ReactNode;
   className?: string;
};
export declare const DropzoneEmptyState: ({
   children,
   className,
}: DropzoneEmptyStateProps) =>
   | string
   | number
   | bigint
   | true
   | import("react/jsx-runtime").JSX.Element
   | Iterable<ReactNode>
   | Promise<
        | string
        | number
        | bigint
        | boolean
        | Iterable<ReactNode>
        | import("react").ReactElement<
             unknown,
             string | import("react").JSXElementConstructor<any>
          >
        | import("react").ReactPortal
        | null
        | undefined
     >
   | null;
//# sourceMappingURL=dropzone.d.ts.map

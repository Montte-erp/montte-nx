import type { ComponentProps, HTMLAttributes } from "react";
import { Badge } from "./badge";
export type AnnouncementProps = ComponentProps<typeof Badge> & {
   themed?: boolean;
};
export declare const Announcement: ({
   variant,
   themed,
   className,
   ...props
}: AnnouncementProps) => import("react/jsx-runtime").JSX.Element;
export type AnnouncementTagProps = HTMLAttributes<HTMLDivElement>;
export declare const AnnouncementTag: ({
   className,
   ...props
}: AnnouncementTagProps) => import("react/jsx-runtime").JSX.Element;
export type AnnouncementTitleProps = HTMLAttributes<HTMLDivElement>;
export declare const AnnouncementTitle: ({
   className,
   ...props
}: AnnouncementTitleProps) => import("react/jsx-runtime").JSX.Element;
//# sourceMappingURL=announcement.d.ts.map

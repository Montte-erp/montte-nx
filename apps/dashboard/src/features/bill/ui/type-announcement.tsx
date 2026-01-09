import {
   Announcement,
   AnnouncementTag,
   AnnouncementTitle,
} from "@packages/ui/components/announcement";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

type BillType = "expense" | "income";

type TypeAnnouncementProps = {
   type: BillType;
   subtitle?: React.ReactNode;
};

export function TypeAnnouncement({ type, subtitle }: TypeAnnouncementProps) {
   const typeConfig = {
      expense: {
         label: "A Pagar",
         icon: ArrowUpRight,
         bg: "#ef444420",
         text: "#ef4444",
      },
      income: {
         label: "A Receber",
         icon: ArrowDownLeft,
         bg: "#10b98120",
         text: "#10b981",
      },
   };

   const config = typeConfig[type];
   const Icon = config.icon;

   return (
      <Announcement>
         <AnnouncementTag
            style={{
               backgroundColor: config.bg,
               color: config.text,
            }}
         >
            <Icon className="size-3.5" />
         </AnnouncementTag>
         <AnnouncementTitle>{config.label}</AnnouncementTitle>
         {subtitle && <AnnouncementTitle>{subtitle}</AnnouncementTitle>}
      </Announcement>
   );
}

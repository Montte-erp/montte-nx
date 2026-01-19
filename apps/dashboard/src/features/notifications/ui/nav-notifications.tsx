import { Button } from "@packages/ui/components/button";
import {
   CredenzaBody,
   CredenzaHeader,
   CredenzaTitle,
} from "@packages/ui/components/credenza";
import {
   DropdownMenu,
   DropdownMenuContent,
   DropdownMenuLabel,
   DropdownMenuSeparator,
   DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemTitle,
} from "@packages/ui/components/item";
import { ScrollArea } from "@packages/ui/components/scroll-area";
import { Separator } from "@packages/ui/components/separator";
import {
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   useSidebar,
} from "@packages/ui/components/sidebar";
import { Skeleton } from "@packages/ui/components/skeleton";
import { cn } from "@packages/ui/lib/utils";
import { Link, useParams } from "@tanstack/react-router";
import { Bell, CheckIcon, Settings, XIcon } from "lucide-react";
import {
   formatNotificationTime,
   getNotificationColor,
   getNotificationIcon,
   type Notification,
   useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import { useCredenza } from "@/hooks/use-credenza";

function NotificationListSkeleton() {
   return (
      <div className="space-y-1 p-2">
         {Array.from({ length: 3 }).map((_, i) => (
            <div
               className="flex items-start gap-3 p-3"
               key={`skeleton-${i + 1}`}
            >
               <Skeleton className="size-9 shrink-0 rounded-full" />
               <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/4" />
               </div>
            </div>
         ))}
      </div>
   );
}

function NotificationListEmpty() {
   return (
      <Empty className="border-none py-8">
         <EmptyHeader>
            <EmptyMedia variant="icon">
               <Bell className="size-5" />
            </EmptyMedia>
            <EmptyTitle className="text-base">Nenhuma notificação</EmptyTitle>
            <EmptyDescription>
               Você está em dia! Novas notificações aparecerão aqui.
            </EmptyDescription>
         </EmptyHeader>
      </Empty>
   );
}

interface NotificationItemInlineProps {
   notification: Notification;
   onMarkAsRead: (id: string) => void;
   onDismiss?: (id: string) => void;
}

function NotificationItemInline({
   notification,
   onMarkAsRead,
   onDismiss,
}: NotificationItemInlineProps) {
   const Icon = getNotificationIcon(notification.type);
   const colors = getNotificationColor(notification.type);

   const handleMarkAsRead = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!notification.isRead) {
         onMarkAsRead(notification.id);
      }
   };

   const handleDismiss = (e: React.MouseEvent) => {
      e.stopPropagation();
      onDismiss?.(notification.id);
   };

   return (
      <Item size="sm" variant={!notification.isRead ? "muted" : "default"}>
         <ItemMedia className={cn(colors.text)} variant="icon">
            <Icon />
         </ItemMedia>
         <ItemContent>
            <ItemTitle>
               {notification.title}
               {!notification.isRead && (
                  <span className="size-2 shrink-0 rounded-full bg-primary" />
               )}
            </ItemTitle>
            <ItemDescription className="text-xs">
               {notification.message}
            </ItemDescription>
            <span className="text-xs text-muted-foreground/70">
               {formatNotificationTime(notification.createdAt)}
            </span>
         </ItemContent>
         <ItemActions className="flex-col">
            {!notification.isRead && (
               <Button
                  aria-label="Marcar como lida"
                  className="size-7"
                  onClick={handleMarkAsRead}
                  size="icon"
                  variant="ghost"
               >
                  <CheckIcon className="size-3.5" />
               </Button>
            )}
            <Separator />
            {onDismiss && (
               <Button
                  aria-label="Dispensar notificação"
                  className="size-7"
                  onClick={handleDismiss}
                  size="icon"
                  variant="ghost"
               >
                  <XIcon className="size-3.5" />
               </Button>
            )}
         </ItemActions>
      </Item>
   );
}

interface NotificationListContentProps {
   notifications: Notification[];
   isLoading: boolean;
   onMarkAsRead: (id: string) => void;
   onDismiss?: (id: string) => void;
}

function NotificationListContent({
   notifications,
   isLoading,
   onMarkAsRead,
   onDismiss,
}: NotificationListContentProps) {
   if (isLoading) {
      return <NotificationListSkeleton />;
   }

   if (notifications.length === 0) {
      return <NotificationListEmpty />;
   }

   return (
      <ItemGroup className="p-2">
         {notifications.map((notification) => (
            <NotificationItemInline
               key={notification.id}
               notification={notification}
               onDismiss={onDismiss}
               onMarkAsRead={onMarkAsRead}
            />
         ))}
      </ItemGroup>
   );
}

/**
 * Reusable credenza content for notifications.
 * Used by NavNotifications on mobile and MoreMenuCredenza.
 */
export function NotificationCredenzaContent() {
   const { slug } = useParams({ strict: false }) as { slug: string };
   const { closeCredenza } = useCredenza();
   const { notifications, isLoading, markAsRead, dismiss } = useNotifications();

   const handleSettingsClick = () => {
      closeCredenza();
   };

   return (
      <>
         <CredenzaHeader className="flex-row items-center justify-between space-y-0 px-4 pb-0">
            <CredenzaTitle>Notificações</CredenzaTitle>
            <Button
               aria-label="Configurações de notificações"
               asChild
               onClick={handleSettingsClick}
               size="icon"
               variant="ghost"
            >
               <Link params={{ slug }} to="/$slug/settings/notifications">
                  <Settings className="size-4" />
               </Link>
            </Button>
         </CredenzaHeader>
         <CredenzaBody className="p-0">
            <ScrollArea className="max-h-[60vh]">
               <NotificationListContent
                  isLoading={isLoading}
                  notifications={notifications}
                  onDismiss={dismiss}
                  onMarkAsRead={markAsRead}
               />
            </ScrollArea>
         </CredenzaBody>
      </>
   );
}

/**
 * Sidebar notification button with desktop dropdown and mobile credenza.
 * Follows the nav-user.tsx pattern.
 */
export function NavNotifications() {
   const { isMobile } = useSidebar();
   const { openCredenza } = useCredenza();
   const { notifications, isLoading, unreadCount, markAsRead, dismiss } =
      useNotifications();
   const { slug } = useParams({ strict: false }) as { slug: string };

   const handleMobileClick = () => {
      openCredenza({
         children: <NotificationCredenzaContent />,
      });
   };

   if (isMobile) {
      return (
         <SidebarMenu>
            <SidebarMenuItem>
               <SidebarMenuButton
                  onClick={handleMobileClick}
                  tooltip="Notificações"
               >
                  <Bell />
                  <span>Notificações</span>
                  {unreadCount > 0 && (
                     <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                        {unreadCount > 9 ? "9+" : unreadCount}
                     </span>
                  )}
               </SidebarMenuButton>
            </SidebarMenuItem>
         </SidebarMenu>
      );
   }

   return (
      <SidebarMenu>
         <SidebarMenuItem>
            <DropdownMenu>
               <DropdownMenuTrigger asChild>
                  <SidebarMenuButton tooltip="Notificações">
                     <Bell />
                     <span>Notificações</span>
                     {unreadCount > 0 && (
                        <span className="ml-auto flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                           {unreadCount > 9 ? "9+" : unreadCount}
                        </span>
                     )}
                  </SidebarMenuButton>
               </DropdownMenuTrigger>
               <DropdownMenuContent
                  align="end"
                  className="w-80 p-0"
                  side="right"
                  sideOffset={8}
               >
                  <DropdownMenuLabel className="flex items-center justify-between px-4 py-3 font-semibold">
                     Notificações
                     <Button
                        aria-label="Configurações de notificações"
                        asChild
                        size="icon"
                        variant="ghost"
                     >
                        <Link
                           params={{ slug }}
                           to="/$slug/settings/notifications"
                        >
                           <Settings className="size-4" />
                        </Link>
                     </Button>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <ScrollArea className="max-h-[400px]">
                     <NotificationListContent
                        isLoading={isLoading}
                        notifications={notifications}
                        onDismiss={dismiss}
                        onMarkAsRead={markAsRead}
                     />
                  </ScrollArea>
               </DropdownMenuContent>
            </DropdownMenu>
         </SidebarMenuItem>
      </SidebarMenu>
   );
}

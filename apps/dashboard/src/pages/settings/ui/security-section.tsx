import { Badge } from "@packages/ui/components/badge";
import { Button } from "@packages/ui/components/button";
import {
   Card,
   CardContent,
   CardDescription,
   CardHeader,
   CardTitle,
} from "@packages/ui/components/card";
import {
   Empty,
   EmptyDescription,
   EmptyHeader,
   EmptyMedia,
   EmptyTitle,
} from "@packages/ui/components/empty";
import { createErrorFallback } from "@packages/ui/components/error-fallback";
import {
   Item,
   ItemActions,
   ItemContent,
   ItemDescription,
   ItemGroup,
   ItemMedia,
   ItemSeparator,
   ItemTitle,
} from "@packages/ui/components/item";
import { Skeleton } from "@packages/ui/components/skeleton";
import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
} from "@packages/ui/components/tooltip";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
   ChevronRight,
   Globe,
   Laptop,
   Link2,
   Mail,
   Monitor,
   Shield,
   Smartphone,
   Tablet,
   User,
} from "lucide-react";
import { Fragment, Suspense } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";
import { useSheet } from "@/hooks/use-sheet";
import { betterAuthClient, useTRPC } from "@/integrations/clients";
import { SessionDetailsForm } from "@/pages/profile/features/session-details-form";
import { useSessionActions } from "@/pages/profile/features/use-session-actions";

function getDeviceIcon(userAgent: string | null | undefined) {
   if (!userAgent) return Monitor;
   const ua = userAgent.toLowerCase();
   if (ua.includes("mobile") || ua.includes("iphone") || ua.includes("android"))
      return Smartphone;
   if (ua.includes("tablet") || ua.includes("ipad")) return Tablet;
   if (ua.includes("mac") || ua.includes("windows") || ua.includes("linux"))
      return Laptop;
   return Monitor;
}

function formatLastActive(date: Date | string | null): string {
   if (!date) return "Agora";
   const d = new Date(date);
   const now = new Date();
   const diff = now.getTime() - d.getTime();
   const minutes = Math.floor(diff / 60000);
   const hours = Math.floor(diff / 3600000);
   const days = Math.floor(diff / 86400000);

   if (minutes < 1) return "Agora";
   if (minutes < 60) return `${minutes} min atrás`;
   if (hours < 24) return `${hours}h atrás`;
   if (days < 7) return `${days}d atrás`;
   return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
   });
}

function getLoginMethodDisplay(method: string | null | undefined): {
   label: string;
   Icon: typeof Mail;
} | null {
   if (!method) return null;

   switch (method) {
      case "email":
         return {
            label: "Email",
            Icon: Mail,
         };
      case "google":
         return {
            label: "Google",
            Icon: Globe,
         };
      case "otp":
         return {
            label: "Código 2FA",
            Icon: Shield,
         };
      case "magic-link":
         return {
            label: "Link Mágico",
            Icon: Link2,
         };
      case "anonymous":
         return {
            label: "Anônimo",
            Icon: User,
         };
      default:
         return { label: method, Icon: Shield };
   }
}

function SecuritySectionErrorFallback(props: FallbackProps) {
   return (
      <Card className="h-full">
         <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>
               Gerencie suas sessões e configurações de segurança.
            </CardDescription>
         </CardHeader>
         <CardContent>
            {createErrorFallback({
               errorDescription:
                  "Ocorreu um erro ao carregar suas sessões ativas.",
               errorTitle: "Erro ao carregar",
               retryText: "Tentar novamente",
            })(props)}
         </CardContent>
      </Card>
   );
}

function SecuritySectionSkeleton() {
   return (
      <div className="space-y-4 md:space-y-6">
         <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Sessions Card Skeleton */}
            <div className="md:col-span-2 lg:col-span-2">
               <Card className="h-full">
                  <CardHeader>
                     <Skeleton className="h-6 w-1/3" />
                     <Skeleton className="h-4 w-2/3" />
                  </CardHeader>
                  <CardContent>
                     <div className="space-y-1">
                        {Array.from({ length: 3 }, (_, i) => i + 1).map(
                           (id) => (
                              <Skeleton
                                 className="h-16 w-full rounded-lg"
                                 key={id}
                              />
                           ),
                        )}
                     </div>
                  </CardContent>
               </Card>
            </div>

            {/* Security Overview Skeleton */}
            <Card className="h-full">
               <CardHeader>
                  <Skeleton className="h-6 w-2/3" />
                  <Skeleton className="h-4 w-full" />
               </CardHeader>
               <CardContent className="space-y-4">
                  <div className="rounded-lg bg-secondary/50 p-4 text-center">
                     <Skeleton className="h-4 w-1/2 mx-auto mb-2" />
                     <Skeleton className="h-10 w-16 mx-auto mb-2" />
                     <Skeleton className="h-5 w-24 mx-auto" />
                  </div>
                  <div className="space-y-2">
                     <Skeleton className="h-10 w-full rounded-lg" />
                     <Skeleton className="h-10 w-full rounded-lg" />
                  </div>
               </CardContent>
            </Card>
         </div>
      </div>
   );
}

// ============================================
// Sessions Card Component
// ============================================

type SessionType = Parameters<typeof SessionDetailsForm>[0]["session"];

function SessionsCard({
   sessions,
   currentSessionId,
   currentSessionLoginMethod,
   openSheet,
}: {
   sessions: SessionType[];
   currentSessionId: string | undefined;
   currentSessionLoginMethod: string | null;
   openSheet: (options: { children: React.ReactNode }) => void;
}) {
   return (
      <Card className="h-full">
         <CardHeader>
            <CardTitle>Segurança</CardTitle>
            <CardDescription>
               Gerencie seus dispositivos conectados e proteja sua conta
            </CardDescription>
         </CardHeader>
         <CardContent>
            {sessions.length === 0 ? (
               <Empty className="border-none py-4">
                  <EmptyHeader>
                     <EmptyMedia variant="icon">
                        <Globe className="size-6" />
                     </EmptyMedia>
                     <EmptyTitle>Nenhuma sessão ativa</EmptyTitle>
                     <EmptyDescription>
                        Suas sessões aparecerão aqui quando você estiver
                        conectado
                     </EmptyDescription>
                  </EmptyHeader>
               </Empty>
            ) : (
               <ItemGroup>
                  {sessions.map((session, index) => {
                     const isCurrentSession = session.id === currentSessionId;
                     const DeviceIcon = getDeviceIcon(
                        session.userAgent ?? null,
                     );
                     // Only show login method for the current session (cookie-based storage)
                     const loginMethod = isCurrentSession
                        ? getLoginMethodDisplay(currentSessionLoginMethod)
                        : null;

                     return (
                        <Fragment key={session.id}>
                           <Item variant="muted">
                              <ItemMedia variant="icon">
                                 <DeviceIcon className="size-4" />
                              </ItemMedia>
                              <ItemContent className="min-w-0">
                                 <div className="flex items-center gap-2 flex-wrap">
                                    <ItemTitle className="truncate">
                                       {session.userAgent ||
                                          "Dispositivo desconhecido"}
                                    </ItemTitle>
                                    {isCurrentSession && (
                                       <Badge
                                          className="bg-green-500 hover:bg-green-500/90 shrink-0"
                                          variant="default"
                                       >
                                          Este dispositivo
                                       </Badge>
                                    )}
                                 </div>
                                 <ItemDescription className="flex items-center gap-2 flex-wrap">
                                    <span>
                                       {session.ipAddress || "IP desconhecido"}
                                    </span>
                                    {loginMethod && (
                                       <>
                                          <span className="text-muted-foreground/50">
                                             •
                                          </span>
                                          <span className="flex items-center gap-1">
                                             <loginMethod.Icon className="size-3" />
                                             {loginMethod.label}
                                          </span>
                                       </>
                                    )}
                                    <span className="text-muted-foreground/50">
                                       •
                                    </span>
                                    <span>
                                       {formatLastActive(session.updatedAt)}
                                    </span>
                                 </ItemDescription>
                              </ItemContent>
                              <ItemActions>
                                 <Tooltip>
                                    <TooltipTrigger asChild>
                                       <Button
                                          onClick={() =>
                                             openSheet({
                                                children: (
                                                   <SessionDetailsForm
                                                      currentSessionId={
                                                         currentSessionId || ""
                                                      }
                                                      session={session}
                                                   />
                                                ),
                                             })
                                          }
                                          size="icon"
                                          variant="ghost"
                                       >
                                          <ChevronRight className="size-4" />
                                       </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                       Ver detalhes
                                    </TooltipContent>
                                 </Tooltip>
                              </ItemActions>
                           </Item>
                           {index !== sessions.length - 1 && <ItemSeparator />}
                        </Fragment>
                     );
                  })}
               </ItemGroup>
            )}
         </CardContent>
      </Card>
   );
}

// ============================================
// Security Overview Card Component
// ============================================

function SessionOverviewCard({ sessions }: { sessions: SessionType[] }) {
   return (
      <Card className="h-full">
         <CardHeader>
            <CardTitle>Visão Geral</CardTitle>
            <CardDescription>Resumo de segurança da sua conta</CardDescription>
         </CardHeader>
         <CardContent className="space-y-4">
            <div className="rounded-lg bg-secondary/50 p-4 text-center">
               <p className="text-xs md:text-sm text-muted-foreground mb-1">
                  Sessões ativas
               </p>
               <p className="text-3xl md:text-4xl font-bold">
                  {sessions.length}
               </p>
               <Badge className="mt-2" variant="secondary">
                  <Monitor className="size-3 mr-1" />
                  {sessions.length === 1 ? "dispositivo" : "dispositivos"}
               </Badge>
            </div>
         </CardContent>
      </Card>
   );
}

// ============================================
// Main Content Component
// ============================================

function SecuritySectionContent() {
   const trpc = useTRPC();
   const { openSheet } = useSheet();
   const { data: sessions } = useSuspenseQuery(
      trpc.session.listAllSessions.queryOptions(),
   );
   const { data: currentSession } = useSuspenseQuery(
      trpc.session.getSession.queryOptions(),
   );

   const { revokeOtherSessions, revokeAllSessions } = useSessionActions();

   const currentSessionId = currentSession?.session?.id;
   const currentSessionLoginMethod =
      betterAuthClient.getLastUsedLoginMethod() ?? null;

   return (
      <TooltipProvider>
         <div className="space-y-4 md:space-y-6">
            <div className="grid gap-4 md:gap-6 md:grid-cols-2 lg:grid-cols-3">
               <div className="md:col-span-2 lg:col-span-2">
                  <SessionsCard
                     currentSessionId={currentSessionId}
                     currentSessionLoginMethod={currentSessionLoginMethod}
                     openSheet={openSheet}
                     sessions={sessions}
                  />
               </div>
               <SessionOverviewCard sessions={sessions} />
            </div>
         </div>
      </TooltipProvider>
   );
}

export function SecuritySection() {
   return (
      <ErrorBoundary FallbackComponent={SecuritySectionErrorFallback}>
         <Suspense fallback={<SecuritySectionSkeleton />}>
            <SecuritySectionContent />
         </Suspense>
      </ErrorBoundary>
   );
}

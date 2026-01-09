import { QuickAccessCard } from "@packages/ui/components/quick-access-card";
import { useRouter } from "@tanstack/react-router";
import { Building2, Mail, Palette, Users } from "lucide-react";
import { useActiveOrganization } from "@/hooks/use-active-organization";

export function QuickAccessCards() {
   const router = useRouter();
   const { activeOrganization } = useActiveOrganization();
   const quickAccessItems = [
      {
         description: "Gerencie as equipes da sua organização.",
         icon: <Building2 className="size-5" />,
         onClick: () =>
            router.navigate({
               params: {
                  slug: activeOrganization.slug,
               },
               to: "/$slug/organization/teams",
            }),
         title: "Equipes",
      },
      {
         description: "Visualize e gerencie as transações da sua organização.",
         icon: <Palette className="size-5" />,
         onClick: () =>
            router.navigate({
               params: { slug: activeOrganization.slug },
               to: "/$slug/transactions",
            }),
         title: "Transações",
      },
      {
         description: "Gerencie os membros da sua organização.",
         icon: <Users className="size-5" />,
         onClick: () =>
            router.navigate({
               params: { slug: activeOrganization.slug },
               to: "/$slug/organization/members",
            }),
         title: "Membros",
      },
      {
         description: "Envie e gerencie convites para ingressar na organização.",
         icon: <Mail className="size-5" />,
         onClick: () =>
            router.navigate({
               params: { slug: activeOrganization.slug },
               to: "/$slug/organization/invites",
            }),
         title: "Convites",
      },
   ];

   return (
      <div className="col-span-1 grid grid-cols-2 gap-4">
         {quickAccessItems.map((item, index) => (
            <QuickAccessCard
               description={item.description}
               icon={item.icon}
               key={`quick-access-${index + 1}`}
               onClick={item.onClick}
               title={item.title}
            />
         ))}
      </div>
   );
}

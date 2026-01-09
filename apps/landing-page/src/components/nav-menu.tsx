import {
   NavigationMenu,
   NavigationMenuContent,
   NavigationMenuItem,
   NavigationMenuLink,
   NavigationMenuList,
   NavigationMenuTrigger,
   navigationMenuTriggerStyle,
} from "@packages/ui/components/navigation-menu";
import { cn } from "@packages/ui/lib/utils";
import {
   BarChart3,
   CalendarCheck,
   Code,
   PiggyBank,
   Receipt,
   Users,
} from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { menuItems, productItems } from "../data/menu-items";

interface NavMenuProps extends ComponentProps<"nav"> {
   orientation?: "horizontal" | "vertical";
}

const productIcons: Record<string, typeof Receipt> = {
   "/features/analytics": BarChart3,
   "/features/bill-tracking": CalendarCheck,
   "/features/budgeting": PiggyBank,
   "/features/collaboration": Users,
   "/features/open-source": Code,
   "/features/smart-transactions": Receipt,
};

function ListItem({
   title,
   children,
   href,
   icon: Icon,
   className,
   ...props
}: {
   title: string;
   children?: ReactNode;
   href: string;
   icon?: typeof Receipt;
   className?: string;
}) {
   return (
      <li {...props}>
         <NavigationMenuLink asChild>
            <a
               className={cn(
                  "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
                  className,
               )}
               href={href}
            >
               <div className="flex items-center gap-2">
                  {Icon && <Icon className="size-4 text-muted-foreground" />}
                  <div className="text-sm font-medium leading-none">
                     {title}
                  </div>
               </div>
               {children && (
                  <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
                     {children}
                  </p>
               )}
            </a>
         </NavigationMenuLink>
      </li>
   );
}

export const NavMenu = ({
   orientation = "horizontal",
}: NavMenuProps) => {
   return (
      <NavigationMenu
         className={orientation === "vertical" ? "flex-col items-start" : ""}
      >
         <NavigationMenuList
            className={cn(
               orientation === "vertical"
                  ? "flex-col items-start justify-start space-x-0 space-y-2"
                  : "gap-1",
            )}
         >
            <NavigationMenuItem>
               <NavigationMenuTrigger className="bg-transparent">
                  Produto
               </NavigationMenuTrigger>
               <NavigationMenuContent>
                  <ul className="grid gap-3 p-4 md:w-[400px] lg:w-[500px] md:grid-cols-2">
                     {productItems.map((item) => {
                        const Icon = productIcons[item.href];
                        return (
                           <ListItem
                              href={item.href}
                              icon={Icon}
                              key={item.href}
                              title={item.name}
                           >
                              {item.description}
                           </ListItem>
                        );
                     })}
                  </ul>
               </NavigationMenuContent>
            </NavigationMenuItem>

            {menuItems.map((item) => (
               <NavigationMenuItem key={item.href}>
                  <NavigationMenuLink
                     asChild
                     className={cn(
                        navigationMenuTriggerStyle(),
                        "bg-transparent",
                        orientation === "vertical" && "justify-start w-full",
                     )}
                  >
                     <a href={item.href}>{item.name}</a>
                  </NavigationMenuLink>
               </NavigationMenuItem>
            ))}
         </NavigationMenuList>
      </NavigationMenu>
   );
};

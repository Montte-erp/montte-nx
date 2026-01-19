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

function FeaturedItem({
   title,
   description,
   href,
}: {
   title: string;
   description: string;
   href: string;
}) {
   return (
      <li className="row-span-3">
         <NavigationMenuLink asChild>
            <a
               className="flex h-full w-full select-none flex-col rounded-md bg-gradient-to-b from-primary/10 to-primary/5 no-underline outline-none transition-colors hover:from-primary/20 hover:to-primary/10 focus:shadow-md overflow-hidden"
               href={href}
            >
               <div className="flex-1 relative min-h-[120px]">
                  <img
                     alt={title}
                     className="absolute inset-0 w-full h-full object-cover dark:block hidden"
                     src="https://placehold.co/400x200/151925/22c55e?text=Transacoes"
                  />
                  <img
                     alt={title}
                     className="absolute inset-0 w-full h-full object-cover dark:hidden block"
                     src="https://placehold.co/400x200/e8f5e9/22c55e?text=Transacoes"
                  />
               </div>
               <div className="p-4">
                  <div className="mb-1 text-base font-medium text-foreground">
                     {title}
                  </div>
                  <p className="text-sm leading-snug text-muted-foreground">
                     {description}
                  </p>
               </div>
            </a>
         </NavigationMenuLink>
      </li>
   );
}

export const NavMenu = ({ orientation = "horizontal" }: NavMenuProps) => {
   // Split product items: first one is featured, rest are in grid
   const [featuredItem, ...gridItems] = productItems;

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
                  <ul className="grid gap-3 p-4 md:w-[450px] lg:w-[550px] md:grid-cols-[1fr_1fr_1fr]">
                     <FeaturedItem
                        description={featuredItem.description}
                        href={featuredItem.href}
                        title={featuredItem.name}
                     />
                     {gridItems.map((item) => {
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

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

type NavigationItem = {
   description: string;
   href: string;
   title: string;
};

type AstroNavigationMenuProps = {
   items: NavigationItem[];
};

export function AstroNavigationMenu({ items }: AstroNavigationMenuProps) {
   return (
      <NavigationMenu className="hidden lg:flex" viewport={false}>
         <NavigationMenuList>
            {items.map((item) => (
               <NavigationMenuItem key={item.href}>
                  <NavigationMenuTrigger>{item.title}</NavigationMenuTrigger>
                  <NavigationMenuContent>
                     <NavigationMenuLink className="w-64" href={item.href}>
                        <span className="font-medium leading-none text-foreground">
                           {item.title}
                        </span>
                        <span className="leading-snug text-muted-foreground">
                           {item.description}
                        </span>
                     </NavigationMenuLink>
                  </NavigationMenuContent>
               </NavigationMenuItem>
            ))}

            <NavigationMenuItem>
               <NavigationMenuLink
                  className={cn(navigationMenuTriggerStyle(), "flex-row")}
                  href="/contato"
               >
                  Contato
               </NavigationMenuLink>
            </NavigationMenuItem>
         </NavigationMenuList>
      </NavigationMenu>
   );
}

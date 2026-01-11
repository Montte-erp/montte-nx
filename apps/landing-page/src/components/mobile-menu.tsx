import { Button } from "@packages/ui/components/button";
import {
   Sheet,
   SheetContent,
   SheetDescription,
   SheetHeader,
   SheetTitle,
} from "@packages/ui/components/sheet";
import {
   BarChart3,
   CalendarCheck,
   Menu,
   PiggyBank,
   Receipt,
   Users,
} from "lucide-react";
import { useState } from "react";
import { menuItems, productItems } from "../data/menu-items";

const productIcons: Record<string, typeof Receipt> = {
   "/features/analytics": BarChart3,
   "/features/bill-tracking": CalendarCheck,
   "/features/budgeting": PiggyBank,
   "/features/collaboration": Users,
   "/features/smart-transactions": Receipt,
};

export function MobileMenu() {
   const [open, setOpen] = useState(false);

   return (
      <div className="md:hidden">
         <Button
            aria-label="Abrir menu"
            onClick={() => setOpen(true)}
            size="icon"
            variant="outline"
         >
            <Menu className="size-6" />
         </Button>
         <Sheet onOpenChange={setOpen} open={open}>
            <SheetContent className="space-y-4 overflow-y-auto" side="right">
               <SheetHeader>
                  <SheetTitle>Menu</SheetTitle>
                  <SheetDescription>
                     Explore nossas funcionalidades
                  </SheetDescription>
               </SheetHeader>

               <div className="space-y-6 px-4">
                  <div>
                     <p className="text-sm font-medium text-foreground mb-3">
                        Produto
                     </p>
                     <ul className="space-y-1">
                        {productItems.map((item) => {
                           const Icon = productIcons[item.href];
                           return (
                              <li key={item.href}>
                                 <a
                                    className="flex items-start gap-3 rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                                    href={item.href}
                                    onClick={() => setOpen(false)}
                                 >
                                    {Icon && (
                                       <Icon className="size-4 mt-0.5 flex-shrink-0" />
                                    )}
                                    <div>
                                       <div className="text-sm font-medium leading-none text-foreground">
                                          {item.name}
                                       </div>
                                       <p className="text-xs text-muted-foreground mt-1">
                                          {item.description}
                                       </p>
                                    </div>
                                 </a>
                              </li>
                           );
                        })}
                     </ul>
                  </div>

                  <div className="border-t pt-4">
                     <ul className="space-y-1">
                        {menuItems.map((item) => (
                           <li key={item.href}>
                              <a
                                 className="flex flex-col rounded-md p-2 hover:bg-accent transition-colors"
                                 href={item.href}
                                 onClick={() => setOpen(false)}
                              >
                                 <span className="text-sm font-medium text-foreground">
                                    {item.name}
                                 </span>
                                 <span className="text-xs text-muted-foreground">
                                    {item.description}
                                 </span>
                              </a>
                           </li>
                        ))}
                     </ul>
                  </div>
               </div>

               <div className="px-4 w-full mt-auto">
                  <Button className="w-full" variant="outline">
                     <a
                        href="https://app.montte.co/auth/sign-in"
                        rel="noopener noreferrer"
                        target="_blank"
                     >
                        Começar
                     </a>
                  </Button>
               </div>
            </SheetContent>
         </Sheet>
      </div>
   );
}

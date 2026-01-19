import { Button } from "@packages/ui/components/button";
import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";

export function NotFound() {
   const navigate = useNavigate();

   return (
      <div className="flex min-h-screen items-center justify-center">
         <div className="text-center">
            <h1 className="text-4xl font-bold">Página Não Encontrada</h1>
            <p className="text-muted-foreground">
               A página que você está procurando não existe ou foi movida.
            </p>
            <Button onClick={() => navigate({ to: "/auth/sign-in" })}>
               <Search className="mr-2 h-4 w-4" />
               Go to Dashboard
            </Button>
         </div>
      </div>
   );
}

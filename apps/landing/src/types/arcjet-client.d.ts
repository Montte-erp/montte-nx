import type { ArcjetDecision } from "@arcjet/protocol";

declare module "arcjet:client" {
   const aj: {
      protect: (
         request: Request,
         properties: { email: string },
      ) => Promise<ArcjetDecision>;
   };

   export default aj;
}

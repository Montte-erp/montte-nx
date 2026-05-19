declare module "arcjet:client" {
   const aj: {
      protect: (request: Request, properties?: unknown) => Promise<unknown>;
   };

   export default aj;
}

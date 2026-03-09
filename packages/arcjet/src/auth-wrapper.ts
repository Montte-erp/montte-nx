import type { AuthInstance } from "@core/authentication/server";

export async function wrapAuthHandler(
   authInstance: AuthInstance,
): Promise<(request: Request) => Promise<Response>> {
   return async (request: Request): Promise<Response> => {
      return authInstance.handler(request);
   };
}

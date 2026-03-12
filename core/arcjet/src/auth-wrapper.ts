import { auth } from "@core/authentication/server";

export async function wrapAuthHandler(): Promise<
   (request: Request) => Promise<Response>
> {
   return async (request: Request): Promise<Response> => {
      return auth.handler(request);
   };
}

export interface Session {
   userId: string;
   [key: string]: unknown;
}

export type GetSession = (
   req: Request,
) => Session | null | Promise<Session | null>;

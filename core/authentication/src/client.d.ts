export interface AuthClientError {
   status: number;
   statusText: string;
   message?: string;
}
export interface AuthClientOptions {
   apiBaseUrl: string;
   onSuccess?: () => void;
   onError?: (error: AuthClientError) => void;
}
export declare const createAuthClient: ({
   apiBaseUrl,
   onSuccess,
   onError,
}: AuthClientOptions) => {
   useActiveMember: () => {
      data: {
         id: string;
         organizationId: string;
         userId: string;
         role: string;
         createdAt: Date;
      } | null;
      error: import("@better-fetch/fetch").BetterFetchError | null;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (
         queryParams?:
            | {
                 query?: import("better-auth").SessionQueryParams | undefined;
              }
            | undefined,
      ) => Promise<void>;
   };
   useActiveMemberRole: () => {
      data: {
         role: string;
      } | null;
      error: import("@better-fetch/fetch").BetterFetchError | null;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (
         queryParams?:
            | {
                 query?: import("better-auth").SessionQueryParams | undefined;
              }
            | undefined,
      ) => Promise<void>;
   };
   useActiveOrganization: () => {
      data:
         | import("better-auth").Prettify<
              {
                 id: string;
                 name: string;
                 slug: string;
                 createdAt: Date;
                 logo?: string | null | undefined;
                 metadata?: any;
              } & {
                 members: {
                    id: string;
                    organizationId: string;
                    role: "admin" | "member" | "owner";
                    createdAt: Date;
                    userId: string;
                    teamId?: string | undefined;
                    user: {
                       id: string;
                       email: string;
                       name: string;
                       image?: string | undefined;
                    };
                 }[];
                 invitations: {
                    id: string;
                    organizationId: string;
                    email: string;
                    role: "admin" | "member" | "owner";
                    status: import("better-auth/plugins").InvitationStatus;
                    inviterId: string;
                    expiresAt: Date;
                    createdAt: Date;
                    teamId?: string | undefined;
                 }[];
              }
           >
         | null;
      error: import("@better-fetch/fetch").BetterFetchError | null;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (
         queryParams?:
            | {
                 query?: import("better-auth").SessionQueryParams | undefined;
              }
            | undefined,
      ) => Promise<void>;
   };
   useListOrganizations: () => {
      data:
         | {
              id: string;
              name: string;
              slug: string;
              createdAt: Date;
              logo?: string | null | undefined;
              metadata?: any;
           }[]
         | null;
      error: import("@better-fetch/fetch").BetterFetchError | null;
      isPending: boolean;
      isRefetching: boolean;
      refetch: (
         queryParams?:
            | {
                 query?: import("better-auth").SessionQueryParams | undefined;
              }
            | undefined,
      ) => Promise<void>;
   };
} & {
   admin: {
      banUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
               banReason?: string | undefined;
               banExpiresIn?: number | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
               banReason?: string | undefined;
               banExpiresIn?: number | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               user: import("better-auth/plugins").UserWithRole;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      createUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               password?: string | undefined;
               name: string;
               role?: "admin" | "user" | ("admin" | "user")[] | undefined;
               data?: Record<string, any> | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               password?: string | undefined;
               name: string;
               role?: "admin" | "user" | ("admin" | "user")[] | undefined;
               data?: Record<string, any> | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               user: import("better-auth/plugins").UserWithRole;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      getUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               id: string;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<{
            query: {
               id: string;
            };
            fetchOptions?: FetchOptions | undefined;
         }>,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            import("better-auth/plugins").UserWithRole,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      hasPermission: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<
               {
                  permissions: {
                     readonly user?:
                        | (
                             | "ban"
                             | "create"
                             | "delete"
                             | "get"
                             | "impersonate"
                             | "impersonate-admins"
                             | "list"
                             | "set-password"
                             | "set-role"
                             | "update"
                          )[]
                        | undefined;
                     readonly session?:
                        | ("delete" | "list" | "revoke")[]
                        | undefined;
                  };
               } & {
                  userId?: string | undefined;
                  role?: "admin" | "user" | undefined;
               }
            > &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               permissions: {
                  readonly user?:
                     | (
                          | "ban"
                          | "create"
                          | "delete"
                          | "get"
                          | "impersonate"
                          | "impersonate-admins"
                          | "list"
                          | "set-password"
                          | "set-role"
                          | "update"
                       )[]
                     | undefined;
                  readonly session?:
                     | ("delete" | "list" | "revoke")[]
                     | undefined;
               };
            } & {
               userId?: string | undefined;
               role?: "admin" | "user" | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               error: null;
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      impersonateUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               session: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  userId: string;
                  expiresAt: Date;
                  token: string;
                  ipAddress?: string | null | undefined;
                  userAgent?: string | null | undefined;
               };
               user: import("better-auth/plugins").UserWithRole;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      listUserSessions: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               sessions: import("better-auth/plugins").SessionWithImpersonatedBy[];
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      listUsers: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               searchValue?: string | undefined;
               searchField?: "email" | "name" | undefined;
               searchOperator?:
                  | "contains"
                  | "ends_with"
                  | "starts_with"
                  | undefined;
               limit?: string | number | undefined;
               offset?: string | number | undefined;
               sortBy?: string | undefined;
               sortDirection?: "asc" | "desc" | undefined;
               filterField?: string | undefined;
               filterValue?:
                  | string
                  | number
                  | boolean
                  | string[]
                  | number[]
                  | undefined;
               filterOperator?:
                  | "contains"
                  | "ends_with"
                  | "eq"
                  | "gt"
                  | "gte"
                  | "in"
                  | "lt"
                  | "lte"
                  | "ne"
                  | "not_in"
                  | "starts_with"
                  | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<{
            query: {
               searchValue?: string | undefined;
               searchField?: "email" | "name" | undefined;
               searchOperator?:
                  | "contains"
                  | "ends_with"
                  | "starts_with"
                  | undefined;
               limit?: string | number | undefined;
               offset?: string | number | undefined;
               sortBy?: string | undefined;
               sortDirection?: "asc" | "desc" | undefined;
               filterField?: string | undefined;
               filterValue?:
                  | string
                  | number
                  | boolean
                  | string[]
                  | number[]
                  | undefined;
               filterOperator?:
                  | "contains"
                  | "ends_with"
                  | "eq"
                  | "gt"
                  | "gte"
                  | "in"
                  | "lt"
                  | "lte"
                  | "ne"
                  | "not_in"
                  | "starts_with"
                  | undefined;
            };
            fetchOptions?: FetchOptions | undefined;
         }>,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               users: import("better-auth/plugins").UserWithRole[];
               total: number;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      removeUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      revokeUserSession: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               sessionToken: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               sessionToken: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      revokeUserSessions: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      setRole: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: string;
               role: "admin" | "user" | ("admin" | "user")[];
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: string;
               role: "admin" | "user" | ("admin" | "user")[];
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               user: import("better-auth/plugins").UserWithRole;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      setUserPassword: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               newPassword: string;
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               newPassword: string;
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               status: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      stopImpersonating: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?: Record<string, any> | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               session: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  userId: string;
                  expiresAt: Date;
                  token: string;
                  ipAddress?: string | null | undefined;
                  userAgent?: string | null | undefined;
               } & Record<string, any>;
               user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
               } & Record<string, any>;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      unbanUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               user: import("better-auth/plugins").UserWithRole;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   admin: {
      updateUser: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               userId: unknown;
               data: Record<any, any>;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               userId: unknown;
               data: Record<any, any>;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            import("better-auth/plugins").UserWithRole,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   deleteUser: {
      callback: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               token: string;
               callbackURL?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<{
            query: {
               token: string;
               callbackURL?: string | undefined;
            };
            fetchOptions?: FetchOptions | undefined;
         }>,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
               message: string;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      changeEmail: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               newEmail: string;
               otp: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               newEmail: string;
               otp: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      checkVerificationOtp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               type:
                  | "change-email"
                  | "email-verification"
                  | "forget-password"
                  | "sign-in";
               otp: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               type:
                  | "change-email"
                  | "email-verification"
                  | "forget-password"
                  | "sign-in";
               otp: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      requestEmailChange: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               newEmail: string;
               otp?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               newEmail: string;
               otp?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      requestPasswordReset: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      resetPassword: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               otp: string;
               password: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               otp: string;
               password: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      sendVerificationOtp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               type:
                  | "change-email"
                  | "email-verification"
                  | "forget-password"
                  | "sign-in";
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               type:
                  | "change-email"
                  | "email-verification"
                  | "forget-password"
                  | "sign-in";
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   emailOtp: {
      verifyEmail: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               otp: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               otp: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            | (Omit<
                 {
                    status: boolean;
                    token: string;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & Record<string, any>;
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              })
            | (Omit<
                 {
                    status: boolean;
                    token: null;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & Record<string, any>;
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              }),
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   forgetPassword: {
      emailOtp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   magicLink: {
      verify: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               token: string;
               callbackURL?: string | undefined;
               errorCallbackURL?: string | undefined;
               newUserCallbackURL?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<{
            query: {
               token: string;
               callbackURL?: string | undefined;
               errorCallbackURL?: string | undefined;
               newUserCallbackURL?: string | undefined;
            };
            fetchOptions?: FetchOptions | undefined;
         }>,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            Omit<
               {
                  token: string;
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               },
               "user"
            > & {
               user: import("better-auth").StripEmptyObjects<
                  {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  } & {
                     twoFactorEnabled: boolean | null | undefined;
                  } & {} & {} & {
                     stripeCustomerId?: string | null | undefined;
                  } & {
                     telemetryConsent: boolean;
                  } & {} & {
                     banned: boolean | null | undefined;
                  } & {
                     banExpires?: Date | null | undefined;
                     banReason?: string | null | undefined;
                     role?: string | null | undefined;
                  }
               >;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      acceptInvitation: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               invitationId: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               invitationId: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               invitation: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
                  teamId?: string | undefined;
               };
               member: {
                  id: string;
                  organizationId: string;
                  userId: string;
                  role: string;
                  createdAt: Date;
               };
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      addTeamMember: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               teamId: string;
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               teamId: string;
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               teamId: string;
               userId: string;
               createdAt: Date;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      cancelInvitation: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               invitationId: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               invitationId: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               organizationId: string;
               email: string;
               role: "admin" | "member" | "owner";
               status: import("better-auth/plugins").InvitationStatus;
               inviterId: string;
               expiresAt: Date;
               createdAt: Date;
               teamId?: string | undefined;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      checkSlug: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               slug: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               slug: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               status: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      create: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               name: string;
               slug: string;
               userId?: string | undefined;
               logo?: string | undefined;
               metadata?: Record<string, any> | undefined;
               keepCurrentActiveOrganization?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               name: string;
               slug: string;
               userId?: string | undefined;
               logo?: string | undefined;
               metadata?: Record<string, any> | undefined;
               keepCurrentActiveOrganization?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               {
                  id: string;
                  name: string;
                  slug: string;
                  createdAt: Date;
                  logo?: string | null | undefined;
                  metadata?: any;
               } & {
                  metadata: any;
                  members: (
                     | {
                          id: string;
                          organizationId: string;
                          userId: string;
                          role: string;
                          createdAt: Date;
                       }
                     | undefined
                  )[];
               }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      createTeam: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               name: string;
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               name: string;
               organizationId?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               organizationId: string;
               createdAt: Date;
               updatedAt?: Date | undefined;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      delete: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               organizationId: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               organizationId: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               slug: string;
               createdAt: Date;
               logo?: string | null | undefined;
               metadata?: any;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      getActiveMember: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?: Record<string, any> | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               Omit<
                  {
                     id: string;
                     organizationId: string;
                     role: "admin" | "member" | "owner";
                     createdAt: Date;
                     userId: string;
                     teamId?: string | undefined;
                     user: {
                        id: string;
                        email: string;
                        name: string;
                        image?: string | undefined;
                     };
                  } & {
                     user: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        email: string;
                        emailVerified: boolean;
                        name: string;
                        image?: string | null | undefined;
                     };
                  },
                  "user"
               > & {
                  user: {
                     id: string;
                     name: string;
                     email: string;
                     image: string | undefined;
                  };
               }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      getActiveMemberRole: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               userId?: string | undefined;
               organizationId?: string | undefined;
               organizationSlug?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         userId?: string | undefined;
                         organizationId?: string | undefined;
                         organizationSlug?: string | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               role: "admin" | "member" | "owner";
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      getFullOrganization: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               organizationId?: string | undefined;
               organizationSlug?: string | undefined;
               membersLimit?: string | number | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         organizationId?: string | undefined;
                         organizationSlug?: string | undefined;
                         membersLimit?: string | number | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               members: {
                  id: string;
                  organizationId: string;
                  role: "admin" | "member" | "owner";
                  createdAt: Date;
                  userId: string;
                  teamId?: string | undefined;
                  user: {
                     id: string;
                     email: string;
                     name: string;
                     image?: string | undefined;
                  };
               }[];
               invitations: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
                  teamId?: string | undefined;
               }[];
               teams: {
                  id: string;
                  name: string;
                  organizationId: string;
                  createdAt: Date;
                  updatedAt?: Date | undefined;
               }[];
            } & {
               id: string;
               name: string;
               slug: string;
               createdAt: Date;
               logo?: string | null | undefined;
               metadata?: any;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      getInvitation: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               id: string;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<{
            query: {
               id: string;
            };
            fetchOptions?: FetchOptions | undefined;
         }>,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
                  teamId?: string | undefined;
               } & {
                  organizationName: string;
                  organizationSlug: string;
                  inviterEmail: string;
               }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      hasPermission: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<
               {
                  permissions: {
                     readonly organization?:
                        | ("delete" | "update")[]
                        | undefined;
                     readonly member?:
                        | ("create" | "delete" | "update")[]
                        | undefined;
                     readonly invitation?: ("cancel" | "create")[] | undefined;
                     readonly team?:
                        | ("create" | "delete" | "update")[]
                        | undefined;
                     readonly ac?:
                        | ("create" | "delete" | "read" | "update")[]
                        | undefined;
                  };
               } & {
                  organizationId?: string | undefined;
               }
            > &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               permissions: {
                  readonly organization?: ("delete" | "update")[] | undefined;
                  readonly member?:
                     | ("create" | "delete" | "update")[]
                     | undefined;
                  readonly invitation?: ("cancel" | "create")[] | undefined;
                  readonly team?:
                     | ("create" | "delete" | "update")[]
                     | undefined;
                  readonly ac?:
                     | ("create" | "delete" | "read" | "update")[]
                     | undefined;
               };
            } & {
               organizationId?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               error: null;
               success: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      inviteMember: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<
               {
                  email: string;
                  role:
                     | "admin"
                     | "member"
                     | "owner"
                     | ("admin" | "member" | "owner")[];
                  organizationId?: string | undefined;
                  resend?: boolean | undefined;
               } & {
                  teamId?: string | string[] | undefined;
               }
            > &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               role:
                  | "admin"
                  | "member"
                  | "owner"
                  | ("admin" | "member" | "owner")[];
               organizationId?: string | undefined;
               resend?: boolean | undefined;
            } & {
               teamId?: string | string[] | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               | {
                    id: string;
                    organizationId: string;
                    email: string;
                    role: "admin" | "member" | "owner";
                    status: import("better-auth/plugins").InvitationStatus;
                    inviterId: string;
                    expiresAt: Date;
                    createdAt: Date;
                    teamId?: string | undefined;
                 }
               | {
                    id: string;
                    organizationId: string;
                    email: string;
                    role: "admin" | "member" | "owner";
                    status: import("better-auth/plugins").InvitationStatus;
                    inviterId: string;
                    expiresAt: Date;
                    createdAt: Date;
                    teamId?: string | undefined;
                 }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      leave: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               organizationId: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               organizationId: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               Omit<
                  {
                     id: string;
                     organizationId: string;
                     role: "admin" | "member" | "owner";
                     createdAt: Date;
                     userId: string;
                     teamId?: string | undefined;
                     user: {
                        id: string;
                        email: string;
                        name: string;
                        image?: string | undefined;
                     };
                  } & {
                     user: {
                        id: string;
                        createdAt: Date;
                        updatedAt: Date;
                        email: string;
                        emailVerified: boolean;
                        name: string;
                        image?: string | null | undefined;
                     };
                  },
                  "user"
               > & {
                  user: {
                     id: string;
                     name: string;
                     email: string;
                     image: string | undefined;
                  };
               }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      list: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?: Record<string, any> | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               slug: string;
               createdAt: Date;
               logo?: string | null | undefined;
               metadata?: any;
            }[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      listInvitations: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         organizationId?: string | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               organizationId: string;
               email: string;
               role: "admin" | "member" | "owner";
               status: import("better-auth/plugins").InvitationStatus;
               inviterId: string;
               expiresAt: Date;
               createdAt: Date;
               teamId?: string | undefined;
            }[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      listMembers: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               limit?: string | number | undefined;
               offset?: string | number | undefined;
               sortBy?: string | undefined;
               sortDirection?: "asc" | "desc" | undefined;
               filterField?: string | undefined;
               filterValue?:
                  | string
                  | number
                  | boolean
                  | string[]
                  | number[]
                  | undefined;
               filterOperator?:
                  | "contains"
                  | "ends_with"
                  | "eq"
                  | "gt"
                  | "gte"
                  | "in"
                  | "lt"
                  | "lte"
                  | "ne"
                  | "not_in"
                  | "starts_with"
                  | undefined;
               organizationId?: string | undefined;
               organizationSlug?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         limit?: string | number | undefined;
                         offset?: string | number | undefined;
                         sortBy?: string | undefined;
                         sortDirection?: "asc" | "desc" | undefined;
                         filterField?: string | undefined;
                         filterValue?:
                            | string
                            | number
                            | boolean
                            | string[]
                            | number[]
                            | undefined;
                         filterOperator?:
                            | "contains"
                            | "ends_with"
                            | "eq"
                            | "gt"
                            | "gte"
                            | "in"
                            | "lt"
                            | "lte"
                            | "ne"
                            | "not_in"
                            | "starts_with"
                            | undefined;
                         organizationId?: string | undefined;
                         organizationSlug?: string | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               members: ({
                  id: string;
                  organizationId: string;
                  role: "admin" | "member" | "owner";
                  createdAt: Date;
                  userId: string;
                  teamId?: string | undefined;
                  user: {
                     id: string;
                     email: string;
                     name: string;
                     image?: string | undefined;
                  };
               } & {
                  user: {
                     id: string;
                     name: string;
                     email: string;
                     image: string | null | undefined;
                  };
               })[];
               total: number;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      listTeamMembers: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               teamId?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         teamId?: string | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               teamId: string;
               userId: string;
               createdAt: Date;
            }[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      listTeams: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         organizationId?: string | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               organizationId: string;
               createdAt: Date;
               updatedAt?: Date | undefined;
            }[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      listUserInvitations: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               email?: string | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         email?: string | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            (Omit<
               {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
                  teamId?: string | undefined;
               } & {
                  organization: {
                     id: string;
                     name: string;
                     slug: string;
                     createdAt: Date;
                     logo?: string | null | undefined;
                     metadata?: any;
                  };
               },
               "organization"
            > & {
               organizationName: string;
            })[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      listUserTeams: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?: Record<string, any> | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               organizationId: string;
               createdAt: Date;
               updatedAt?: Date | undefined;
            }[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      rejectInvitation: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               invitationId: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               invitationId: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               invitation: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
               } | null;
               member: null;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      removeMember: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               memberIdOrEmail: string;
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               memberIdOrEmail: string;
               organizationId?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               member: {
                  id: string;
                  organizationId: string;
                  role: "admin" | "member" | "owner";
                  createdAt: Date;
                  userId: string;
                  teamId?: string | undefined;
                  user: {
                     id: string;
                     email: string;
                     name: string;
                     image?: string | undefined;
                  };
               };
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      removeTeam: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               teamId: string;
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               teamId: string;
               organizationId?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               message: string;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      removeTeamMember: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               teamId: string;
               userId: unknown;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               teamId: string;
               userId: unknown;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               message: string;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      setActive: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               organizationId?: string | null | undefined;
               organizationSlug?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<
                 {
                    organizationId?: string | null | undefined;
                    organizationSlug?: string | undefined;
                 } & {
                    fetchOptions?: FetchOptions | undefined;
                 }
              >
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               members: {
                  id: string;
                  organizationId: string;
                  role: "admin" | "member" | "owner";
                  createdAt: Date;
                  userId: string;
                  teamId?: string | undefined;
                  user: {
                     id: string;
                     email: string;
                     name: string;
                     image?: string | undefined;
                  };
               }[];
               invitations: {
                  id: string;
                  organizationId: string;
                  email: string;
                  role: "admin" | "member" | "owner";
                  status: import("better-auth/plugins").InvitationStatus;
                  inviterId: string;
                  expiresAt: Date;
                  createdAt: Date;
                  teamId?: string | undefined;
               }[];
               teams: {
                  id: string;
                  name: string;
                  organizationId: string;
                  createdAt: Date;
                  updatedAt?: Date | undefined;
               }[];
            } & {
               id: string;
               name: string;
               slug: string;
               createdAt: Date;
               logo?: string | null | undefined;
               metadata?: any;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      setActiveTeam: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               teamId?: string | null | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<
                 {
                    teamId?: string | null | undefined;
                 } & {
                    fetchOptions?: FetchOptions | undefined;
                 }
              >
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               organizationId: string;
               createdAt: Date;
               updatedAt?: Date | undefined;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      update: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               data: {
                  name?: string | undefined;
                  slug?: string | undefined;
                  logo?: string | undefined;
                  metadata?: Record<string, any> | undefined;
               } & Partial<{}>;
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               data: {
                  name?: string | undefined;
                  slug?: string | undefined;
                  logo?: string | undefined;
                  metadata?: Record<string, any> | undefined;
               } & Partial<{}>;
               organizationId?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               slug: string;
               createdAt: Date;
               logo?: string | null | undefined;
               metadata?: any;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      updateMemberRole: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               role:
                  | "admin"
                  | "member"
                  | "owner"
                  | import("better-auth").LiteralString[]
                  | ("admin" | "member" | "owner")[]
                  | import("better-auth").LiteralString;
               memberId: string;
               organizationId?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               role:
                  | "admin"
                  | "member"
                  | "owner"
                  | import("better-auth").LiteralString[]
                  | ("admin" | "member" | "owner")[]
                  | import("better-auth").LiteralString;
               memberId: string;
               organizationId?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               organizationId: string;
               role: "admin" | "member" | "owner";
               createdAt: Date;
               userId: string;
               user: {
                  id: string;
                  email: string;
                  name: string;
                  image?: string | undefined;
               };
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   organization: {
      updateTeam: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               teamId: string;
               data: Partial<{
                  name: string;
                  organizationId: string;
               }>;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               teamId: string;
               data: Partial<{
                  name: string;
                  organizationId: string;
               }>;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               id: string;
               name: string;
               organizationId: string;
               createdAt: Date;
               updatedAt?: Date | undefined;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   resetPassword: {
      ":token": <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               callbackURL: string;
            }> &
               Record<string, any>,
            {
               token: string;
            }
         >,
      >(
         data_0: import("better-auth").Prettify<{
            query: {
               callbackURL: string;
            };
            fetchOptions?: FetchOptions | undefined;
         }>,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            never,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   signIn: {
      email: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               password: string;
               callbackURL?: string | undefined;
               rememberMe?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               password: string;
               callbackURL?: string | undefined;
               rememberMe?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            Omit<
               {
                  redirect: boolean;
                  token: string;
                  url?: string | undefined;
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               },
               "user"
            > & {
               user: import("better-auth").StripEmptyObjects<
                  {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  } & {
                     twoFactorEnabled: boolean | null | undefined;
                  } & {} & {} & {
                     stripeCustomerId?: string | null | undefined;
                  } & {
                     telemetryConsent: boolean;
                  } & {} & {
                     banned: boolean | null | undefined;
                  } & {
                     banExpires?: Date | null | undefined;
                     banReason?: string | null | undefined;
                     role?: string | null | undefined;
                  }
               >;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   signIn: {
      emailOtp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<
               {
                  email: string;
                  otp: string;
                  name?: string | undefined;
                  image?: string | undefined;
               } & Record<string, any>
            > &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               otp: string;
               name?: string | undefined;
               image?: string | undefined;
            } & Record<string, any> & {
                  fetchOptions?: FetchOptions | undefined;
               }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            Omit<
               {
                  token: string;
                  user: {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
               },
               "user"
            > & {
               user: import("better-auth").StripEmptyObjects<
                  {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  } & {
                     twoFactorEnabled: boolean | null | undefined;
                  } & {} & {} & {
                     stripeCustomerId?: string | null | undefined;
                  } & {
                     telemetryConsent: boolean;
                  } & {} & {
                     banned: boolean | null | undefined;
                  } & {
                     banExpires?: Date | null | undefined;
                     banReason?: string | null | undefined;
                     role?: string | null | undefined;
                  }
               >;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   signIn: {
      magicLink: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               email: string;
               name?: string | undefined;
               callbackURL?: string | undefined;
               newUserCallbackURL?: string | undefined;
               errorCallbackURL?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               email: string;
               name?: string | undefined;
               callbackURL?: string | undefined;
               newUserCallbackURL?: string | undefined;
               errorCallbackURL?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               status: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   signIn: {
      social: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               callbackURL?: string | undefined;
               newUserCallbackURL?: string | undefined;
               errorCallbackURL?: string | undefined;
               provider:
                  | "apple"
                  | "atlassian"
                  | "cognito"
                  | "discord"
                  | "dropbox"
                  | "facebook"
                  | "figma"
                  | "github"
                  | "gitlab"
                  | "google"
                  | "huggingface"
                  | "kakao"
                  | "kick"
                  | "line"
                  | "linear"
                  | "linkedin"
                  | "microsoft"
                  | "naver"
                  | "notion"
                  | "paybin"
                  | "paypal"
                  | "polar"
                  | "railway"
                  | "reddit"
                  | "roblox"
                  | "salesforce"
                  | "slack"
                  | "spotify"
                  | "tiktok"
                  | "twitch"
                  | "twitter"
                  | "vercel"
                  | "vk"
                  | "zoom"
                  | (string & {});
               disableRedirect?: boolean | undefined;
               idToken?:
                  | {
                       token: string;
                       nonce?: string | undefined;
                       accessToken?: string | undefined;
                       refreshToken?: string | undefined;
                       expiresAt?: number | undefined;
                       user?:
                          | {
                               name?:
                                  | {
                                       firstName?: string | undefined;
                                       lastName?: string | undefined;
                                    }
                                  | undefined;
                               email?: string | undefined;
                            }
                          | undefined;
                    }
                  | undefined;
               scopes?: string[] | undefined;
               requestSignUp?: boolean | undefined;
               loginHint?: string | undefined;
               additionalData?: Record<string, any> | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               callbackURL?: string | undefined;
               newUserCallbackURL?: string | undefined;
               errorCallbackURL?: string | undefined;
               provider:
                  | "apple"
                  | "atlassian"
                  | "cognito"
                  | "discord"
                  | "dropbox"
                  | "facebook"
                  | "figma"
                  | "github"
                  | "gitlab"
                  | "google"
                  | "huggingface"
                  | "kakao"
                  | "kick"
                  | "line"
                  | "linear"
                  | "linkedin"
                  | "microsoft"
                  | "naver"
                  | "notion"
                  | "paybin"
                  | "paypal"
                  | "polar"
                  | "railway"
                  | "reddit"
                  | "roblox"
                  | "salesforce"
                  | "slack"
                  | "spotify"
                  | "tiktok"
                  | "twitch"
                  | "twitter"
                  | "vercel"
                  | "vk"
                  | "zoom"
                  | (string & {});
               disableRedirect?: boolean | undefined;
               idToken?:
                  | {
                       token: string;
                       nonce?: string | undefined;
                       accessToken?: string | undefined;
                       refreshToken?: string | undefined;
                       expiresAt?: number | undefined;
                       user?:
                          | {
                               name?:
                                  | {
                                       firstName?: string | undefined;
                                       lastName?: string | undefined;
                                    }
                                  | undefined;
                               email?: string | undefined;
                            }
                          | undefined;
                    }
                  | undefined;
               scopes?: string[] | undefined;
               requestSignUp?: boolean | undefined;
               loginHint?: string | undefined;
               additionalData?: Record<string, any> | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            | {
                 redirect: boolean;
                 url: string;
              }
            | (Omit<
                 {
                    redirect: boolean;
                    token: string;
                    url: undefined;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              }),
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   signUp: {
      email: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               name: string;
               email: string;
               password: string;
               image?: string | undefined;
               callbackURL?: string | undefined;
               rememberMe?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            import("better-auth/client").InferSignUpEmailCtx<
               {
                  baseURL: string;
                  fetchOptions: {
                     onError: (
                        context: import("@better-fetch/fetch").ErrorContext,
                     ) => void;
                     onSuccess: () => void;
                  };
                  plugins: (
                     | {
                          id: "api-key";
                          $ERROR_CODES: {
                             INVALID_METADATA_TYPE: import("better-auth").RawError<"INVALID_METADATA_TYPE">;
                             REFILL_AMOUNT_AND_INTERVAL_REQUIRED: import("better-auth").RawError<"REFILL_AMOUNT_AND_INTERVAL_REQUIRED">;
                             REFILL_INTERVAL_AND_AMOUNT_REQUIRED: import("better-auth").RawError<"REFILL_INTERVAL_AND_AMOUNT_REQUIRED">;
                             USER_BANNED: import("better-auth").RawError<"USER_BANNED">;
                             UNAUTHORIZED_SESSION: import("better-auth").RawError<"UNAUTHORIZED_SESSION">;
                             KEY_NOT_FOUND: import("better-auth").RawError<"KEY_NOT_FOUND">;
                             KEY_DISABLED: import("better-auth").RawError<"KEY_DISABLED">;
                             KEY_EXPIRED: import("better-auth").RawError<"KEY_EXPIRED">;
                             USAGE_EXCEEDED: import("better-auth").RawError<"USAGE_EXCEEDED">;
                             KEY_NOT_RECOVERABLE: import("better-auth").RawError<"KEY_NOT_RECOVERABLE">;
                             EXPIRES_IN_IS_TOO_SMALL: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_SMALL">;
                             EXPIRES_IN_IS_TOO_LARGE: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_LARGE">;
                             INVALID_REMAINING: import("better-auth").RawError<"INVALID_REMAINING">;
                             INVALID_PREFIX_LENGTH: import("better-auth").RawError<"INVALID_PREFIX_LENGTH">;
                             INVALID_NAME_LENGTH: import("better-auth").RawError<"INVALID_NAME_LENGTH">;
                             METADATA_DISABLED: import("better-auth").RawError<"METADATA_DISABLED">;
                             RATE_LIMIT_EXCEEDED: import("better-auth").RawError<"RATE_LIMIT_EXCEEDED">;
                             NO_VALUES_TO_UPDATE: import("better-auth").RawError<"NO_VALUES_TO_UPDATE">;
                             KEY_DISABLED_EXPIRATION: import("better-auth").RawError<"KEY_DISABLED_EXPIRATION">;
                             INVALID_API_KEY: import("better-auth").RawError<"INVALID_API_KEY">;
                             INVALID_USER_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_USER_ID_FROM_API_KEY">;
                             INVALID_REFERENCE_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_REFERENCE_ID_FROM_API_KEY">;
                             INVALID_API_KEY_GETTER_RETURN_TYPE: import("better-auth").RawError<"INVALID_API_KEY_GETTER_RETURN_TYPE">;
                             SERVER_ONLY_PROPERTY: import("better-auth").RawError<"SERVER_ONLY_PROPERTY">;
                             FAILED_TO_UPDATE_API_KEY: import("better-auth").RawError<"FAILED_TO_UPDATE_API_KEY">;
                             NAME_REQUIRED: import("better-auth").RawError<"NAME_REQUIRED">;
                             ORGANIZATION_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_ID_REQUIRED">;
                             USER_NOT_MEMBER_OF_ORGANIZATION: import("better-auth").RawError<"USER_NOT_MEMBER_OF_ORGANIZATION">;
                             INSUFFICIENT_API_KEY_PERMISSIONS: import("better-auth").RawError<"INSUFFICIENT_API_KEY_PERMISSIONS">;
                             NO_DEFAULT_API_KEY_CONFIGURATION_FOUND: import("better-auth").RawError<"NO_DEFAULT_API_KEY_CONFIGURATION_FOUND">;
                             ORGANIZATION_PLUGIN_REQUIRED: import("better-auth").RawError<"ORGANIZATION_PLUGIN_REQUIRED">;
                          };
                          hooks: {
                             before: {
                                matcher: (
                                   ctx: import("better-auth").HookEndpointContext,
                                ) => boolean;
                                handler: (
                                   inputContext: import("better-call").MiddlewareInputContext<
                                      import("better-call").MiddlewareOptions
                                   >,
                                ) => Promise<
                                   | {
                                        user: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        };
                                        session: {
                                           id: string;
                                           token: string;
                                           userId: string;
                                           userAgent: string | null;
                                           ipAddress: string | null;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           expiresAt: Date;
                                        };
                                     }
                                   | {
                                        context: import("better-call").MiddlewareContext<
                                           import("better-call").MiddlewareOptions,
                                           {
                                              returned?: unknown;
                                              responseHeaders?:
                                                 | Headers
                                                 | undefined;
                                           } & import("better-auth").PluginContext<
                                              import("better-auth").BetterAuthOptions
                                           > &
                                              import("better-auth").InfoContext & {
                                                 options: import("better-auth").BetterAuthOptions;
                                                 trustedOrigins: string[];
                                                 trustedProviders: string[];
                                                 isTrustedOrigin: (
                                                    url: string,
                                                    settings?:
                                                       | {
                                                            allowRelativePaths: boolean;
                                                         }
                                                       | undefined,
                                                 ) => boolean;
                                                 oauthConfig: {
                                                    skipStateCookieCheck?:
                                                       | boolean
                                                       | undefined;
                                                    storeStateStrategy:
                                                       | "cookie"
                                                       | "database";
                                                 };
                                                 newSession: {
                                                    session: {
                                                       id: string;
                                                       createdAt: Date;
                                                       updatedAt: Date;
                                                       userId: string;
                                                       expiresAt: Date;
                                                       token: string;
                                                       ipAddress?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                       userAgent?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                    } & Record<string, any>;
                                                    user: {
                                                       id: string;
                                                       createdAt: Date;
                                                       updatedAt: Date;
                                                       email: string;
                                                       emailVerified: boolean;
                                                       name: string;
                                                       image?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                    } & Record<string, any>;
                                                 } | null;
                                                 session: {
                                                    session: {
                                                       id: string;
                                                       createdAt: Date;
                                                       updatedAt: Date;
                                                       userId: string;
                                                       expiresAt: Date;
                                                       token: string;
                                                       ipAddress?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                       userAgent?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                    } & Record<string, any>;
                                                    user: {
                                                       id: string;
                                                       createdAt: Date;
                                                       updatedAt: Date;
                                                       email: string;
                                                       emailVerified: boolean;
                                                       name: string;
                                                       image?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                    } & Record<string, any>;
                                                 } | null;
                                                 setNewSession: (
                                                    session: {
                                                       session: {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          userId: string;
                                                          expiresAt: Date;
                                                          token: string;
                                                          ipAddress?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                          userAgent?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       } & Record<string, any>;
                                                       user: {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          email: string;
                                                          emailVerified: boolean;
                                                          name: string;
                                                          image?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       } & Record<string, any>;
                                                    } | null,
                                                 ) => void;
                                                 socialProviders: import("better-auth").OAuthProvider<
                                                    Record<string, any>,
                                                    Partial<
                                                       import("better-auth").ProviderOptions<any>
                                                    >
                                                 >[];
                                                 authCookies: import("better-auth").BetterAuthCookies;
                                                 logger: import("better-auth").InternalLogger;
                                                 rateLimit: {
                                                    enabled: boolean;
                                                    window: number;
                                                    max: number;
                                                    storage:
                                                       | "database"
                                                       | "memory"
                                                       | "secondary-storage";
                                                 } & Omit<
                                                    import("better-auth").BetterAuthRateLimitOptions,
                                                    | "enabled"
                                                    | "max"
                                                    | "storage"
                                                    | "window"
                                                 >;
                                                 adapter: import("better-auth").DBAdapter<
                                                    import("better-auth").BetterAuthOptions
                                                 >;
                                                 internalAdapter: import("better-auth").InternalAdapter<
                                                    import("better-auth").BetterAuthOptions
                                                 >;
                                                 createAuthCookie: (
                                                    cookieName: string,
                                                    overrideAttributes?:
                                                       | Partial<
                                                            import("better-call").CookieOptions
                                                         >
                                                       | undefined,
                                                 ) => import("better-auth").BetterAuthCookie;
                                                 secret: string;
                                                 secretConfig:
                                                    | string
                                                    | import("better-auth").SecretConfig;
                                                 sessionConfig: {
                                                    updateAge: number;
                                                    expiresIn: number;
                                                    freshAge: number;
                                                    cookieRefreshCache:
                                                       | false
                                                       | {
                                                            enabled: true;
                                                            updateAge: number;
                                                         };
                                                 };
                                                 generateId: (options: {
                                                    model: import("better-auth").ModelNames;
                                                    size?: number | undefined;
                                                 }) => string | false;
                                                 secondaryStorage:
                                                    | import("better-auth").SecondaryStorage
                                                    | undefined;
                                                 password: {
                                                    hash: (
                                                       password: string,
                                                    ) => Promise<string>;
                                                    verify: (data: {
                                                       password: string;
                                                       hash: string;
                                                    }) => Promise<boolean>;
                                                    config: {
                                                       minPasswordLength: number;
                                                       maxPasswordLength: number;
                                                    };
                                                    checkPassword: (
                                                       userId: string,
                                                       ctx: import("better-auth").GenericEndpointContext<
                                                          import("better-auth").BetterAuthOptions
                                                       >,
                                                    ) => Promise<boolean>;
                                                 };
                                                 tables: import("better-auth").BetterAuthDBSchema;
                                                 runMigrations: () => Promise<void>;
                                                 publishTelemetry: (event: {
                                                    type: string;
                                                    anonymousId?:
                                                       | string
                                                       | undefined;
                                                    payload: Record<
                                                       string,
                                                       any
                                                    >;
                                                 }) => Promise<void>;
                                                 skipOriginCheck:
                                                    | boolean
                                                    | string[];
                                                 skipCSRFCheck: boolean;
                                                 runInBackground: (
                                                    promise: Promise<unknown>,
                                                 ) => void;
                                                 runInBackgroundOrAwait: (
                                                    promise: void | Promise<unknown>,
                                                 ) => unknown;
                                              }
                                        >;
                                     }
                                >;
                             }[];
                          };
                          endpoints: {
                             createApiKey: import("better-call").StrictEndpoint<
                                "/api-key/create",
                                {
                                   method: "POST";
                                   body: import("zod").ZodObject<
                                      {
                                         configId: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         name: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         expiresIn: import("zod").ZodDefault<
                                            import("zod").ZodNullable<
                                               import("zod").ZodOptional<
                                                  import("zod").ZodNumber
                                               >
                                            >
                                         >;
                                         prefix: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         remaining: import("zod").ZodDefault<
                                            import("zod").ZodNullable<
                                               import("zod").ZodOptional<
                                                  import("zod").ZodNumber
                                               >
                                            >
                                         >;
                                         metadata: import("zod").ZodOptional<
                                            import("zod").ZodAny
                                         >;
                                         refillAmount: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         refillInterval: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         rateLimitTimeWindow: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         rateLimitMax: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         rateLimitEnabled: import("zod").ZodOptional<
                                            import("zod").ZodBoolean
                                         >;
                                         permissions: import("zod").ZodOptional<
                                            import("zod").ZodRecord<
                                               import("zod").ZodString,
                                               import("zod").ZodArray<
                                                  import("zod").ZodString
                                               >
                                            >
                                         >;
                                         userId: import("zod").ZodOptional<
                                            import("zod").ZodCoercedString<unknown>
                                         >;
                                         organizationId: import("zod").ZodOptional<
                                            import("zod").ZodCoercedString<unknown>
                                         >;
                                      },
                                      import("better-auth").$strip
                                   >;
                                   metadata: {
                                      openapi: {
                                         description: string;
                                         responses: {
                                            "200": {
                                               description: string;
                                               content: {
                                                  "application/json": {
                                                     schema: {
                                                        type: "object";
                                                        properties: {
                                                           id: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           createdAt: {
                                                              type: string;
                                                              format: string;
                                                              description: string;
                                                           };
                                                           updatedAt: {
                                                              type: string;
                                                              format: string;
                                                              description: string;
                                                           };
                                                           name: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           prefix: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           start: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           key: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           enabled: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           expiresAt: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           referenceId: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           lastRefillAt: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           lastRequest: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           metadata: {
                                                              type: string;
                                                              nullable: boolean;
                                                              additionalProperties: boolean;
                                                              description: string;
                                                           };
                                                           rateLimitMax: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           rateLimitTimeWindow: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           remaining: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           refillAmount: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           refillInterval: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           rateLimitEnabled: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           requestCount: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           permissions: {
                                                              type: string;
                                                              nullable: boolean;
                                                              additionalProperties: {
                                                                 type: string;
                                                                 items: {
                                                                    type: string;
                                                                 };
                                                              };
                                                              description: string;
                                                           };
                                                        };
                                                        required: string[];
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   };
                                },
                                {
                                   key: string;
                                   metadata: any;
                                   permissions: any;
                                   id: string;
                                   configId: string;
                                   name: string | null;
                                   start: string | null;
                                   prefix: string | null;
                                   referenceId: string;
                                   refillInterval: number | null;
                                   refillAmount: number | null;
                                   lastRefillAt: Date | null;
                                   enabled: boolean;
                                   rateLimitEnabled: boolean;
                                   rateLimitTimeWindow: number | null;
                                   rateLimitMax: number | null;
                                   requestCount: number;
                                   remaining: number | null;
                                   lastRequest: Date | null;
                                   expiresAt: Date | null;
                                   createdAt: Date;
                                   updatedAt: Date;
                                }
                             >;
                             verifyApiKey: import("better-call").StrictEndpoint<
                                string,
                                {
                                   method: "POST";
                                   body: import("zod").ZodObject<
                                      {
                                         configId: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         key: import("zod").ZodString;
                                         permissions: import("zod").ZodOptional<
                                            import("zod").ZodRecord<
                                               import("zod").ZodString,
                                               import("zod").ZodArray<
                                                  import("zod").ZodString
                                               >
                                            >
                                         >;
                                      },
                                      import("better-auth").$strip
                                   >;
                                },
                                | {
                                     valid: boolean;
                                     error: {
                                        message: import("better-auth").RawError<"INVALID_API_KEY">;
                                        code: "KEY_NOT_FOUND";
                                     };
                                     key: null;
                                  }
                                | {
                                     valid: boolean;
                                     error: {
                                        message: string | undefined;
                                        code: string;
                                        cause?: unknown;
                                     };
                                     key: null;
                                  }
                                | {
                                     valid: boolean;
                                     error: {
                                        message: import("better-auth").RawError<"INVALID_API_KEY">;
                                        code: "INVALID_API_KEY";
                                     };
                                     key: null;
                                  }
                                | {
                                     valid: boolean;
                                     error: null;
                                     key: Omit<
                                        import("@better-auth/api-key").ApiKey,
                                        "key"
                                     > | null;
                                  }
                             >;
                             getApiKey: import("better-call").StrictEndpoint<
                                "/api-key/get",
                                {
                                   method: "GET";
                                   query: import("zod").ZodObject<
                                      {
                                         configId: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         id: import("zod").ZodString;
                                      },
                                      import("better-auth").$strip
                                   >;
                                   use: ((
                                      inputContext: import("better-call").MiddlewareInputContext<
                                         import("better-call").MiddlewareOptions
                                      >,
                                   ) => Promise<{
                                      session: {
                                         session: Record<string, any> & {
                                            id: string;
                                            createdAt: Date;
                                            updatedAt: Date;
                                            userId: string;
                                            expiresAt: Date;
                                            token: string;
                                            ipAddress?:
                                               | string
                                               | null
                                               | undefined;
                                            userAgent?:
                                               | string
                                               | null
                                               | undefined;
                                         };
                                         user: Record<string, any> & {
                                            id: string;
                                            createdAt: Date;
                                            updatedAt: Date;
                                            email: string;
                                            emailVerified: boolean;
                                            name: string;
                                            image?: string | null | undefined;
                                         };
                                      };
                                   }>)[];
                                   metadata: {
                                      openapi: {
                                         description: string;
                                         responses: {
                                            "200": {
                                               description: string;
                                               content: {
                                                  "application/json": {
                                                     schema: {
                                                        type: "object";
                                                        properties: {
                                                           id: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           name: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           start: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           prefix: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           userId: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           refillInterval: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           refillAmount: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           lastRefillAt: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           enabled: {
                                                              type: string;
                                                              description: string;
                                                              default: boolean;
                                                           };
                                                           rateLimitEnabled: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           rateLimitTimeWindow: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           rateLimitMax: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           requestCount: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           remaining: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           lastRequest: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           expiresAt: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           createdAt: {
                                                              type: string;
                                                              format: string;
                                                              description: string;
                                                           };
                                                           updatedAt: {
                                                              type: string;
                                                              format: string;
                                                              description: string;
                                                           };
                                                           metadata: {
                                                              type: string;
                                                              nullable: boolean;
                                                              additionalProperties: boolean;
                                                              description: string;
                                                           };
                                                           permissions: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                        };
                                                        required: string[];
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   };
                                },
                                {
                                   metadata: Record<string, any> | null;
                                   permissions: {
                                      [key: string]: string[];
                                   } | null;
                                   id: string;
                                   configId: string;
                                   name: string | null;
                                   start: string | null;
                                   prefix: string | null;
                                   referenceId: string;
                                   refillInterval: number | null;
                                   refillAmount: number | null;
                                   lastRefillAt: Date | null;
                                   enabled: boolean;
                                   rateLimitEnabled: boolean;
                                   rateLimitTimeWindow: number | null;
                                   rateLimitMax: number | null;
                                   requestCount: number;
                                   remaining: number | null;
                                   lastRequest: Date | null;
                                   expiresAt: Date | null;
                                   createdAt: Date;
                                   updatedAt: Date;
                                }
                             >;
                             updateApiKey: import("better-call").StrictEndpoint<
                                "/api-key/update",
                                {
                                   method: "POST";
                                   body: import("zod").ZodObject<
                                      {
                                         configId: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         keyId: import("zod").ZodString;
                                         userId: import("zod").ZodOptional<
                                            import("zod").ZodCoercedString<unknown>
                                         >;
                                         name: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         enabled: import("zod").ZodOptional<
                                            import("zod").ZodBoolean
                                         >;
                                         remaining: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         refillAmount: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         refillInterval: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         metadata: import("zod").ZodOptional<
                                            import("zod").ZodAny
                                         >;
                                         expiresIn: import("zod").ZodNullable<
                                            import("zod").ZodOptional<
                                               import("zod").ZodNumber
                                            >
                                         >;
                                         rateLimitEnabled: import("zod").ZodOptional<
                                            import("zod").ZodBoolean
                                         >;
                                         rateLimitTimeWindow: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         rateLimitMax: import("zod").ZodOptional<
                                            import("zod").ZodNumber
                                         >;
                                         permissions: import("zod").ZodNullable<
                                            import("zod").ZodOptional<
                                               import("zod").ZodRecord<
                                                  import("zod").ZodString,
                                                  import("zod").ZodArray<
                                                     import("zod").ZodString
                                                  >
                                               >
                                            >
                                         >;
                                      },
                                      import("better-auth").$strip
                                   >;
                                   metadata: {
                                      openapi: {
                                         description: string;
                                         responses: {
                                            "200": {
                                               description: string;
                                               content: {
                                                  "application/json": {
                                                     schema: {
                                                        type: "object";
                                                        properties: {
                                                           id: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           name: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           start: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           prefix: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           userId: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           refillInterval: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           refillAmount: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           lastRefillAt: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           enabled: {
                                                              type: string;
                                                              description: string;
                                                              default: boolean;
                                                           };
                                                           rateLimitEnabled: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           rateLimitTimeWindow: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           rateLimitMax: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           requestCount: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           remaining: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           lastRequest: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           expiresAt: {
                                                              type: string;
                                                              format: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           createdAt: {
                                                              type: string;
                                                              format: string;
                                                              description: string;
                                                           };
                                                           updatedAt: {
                                                              type: string;
                                                              format: string;
                                                              description: string;
                                                           };
                                                           metadata: {
                                                              type: string;
                                                              nullable: boolean;
                                                              additionalProperties: boolean;
                                                              description: string;
                                                           };
                                                           permissions: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                        };
                                                        required: string[];
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   };
                                },
                                {
                                   metadata: Record<string, any> | null;
                                   permissions: {
                                      [key: string]: string[];
                                   } | null;
                                   id: string;
                                   configId: string;
                                   name: string | null;
                                   start: string | null;
                                   prefix: string | null;
                                   referenceId: string;
                                   refillInterval: number | null;
                                   refillAmount: number | null;
                                   lastRefillAt: Date | null;
                                   enabled: boolean;
                                   rateLimitEnabled: boolean;
                                   rateLimitTimeWindow: number | null;
                                   rateLimitMax: number | null;
                                   requestCount: number;
                                   remaining: number | null;
                                   lastRequest: Date | null;
                                   expiresAt: Date | null;
                                   createdAt: Date;
                                   updatedAt: Date;
                                }
                             >;
                             deleteApiKey: import("better-call").StrictEndpoint<
                                "/api-key/delete",
                                {
                                   method: "POST";
                                   body: import("zod").ZodObject<
                                      {
                                         configId: import("zod").ZodOptional<
                                            import("zod").ZodString
                                         >;
                                         keyId: import("zod").ZodString;
                                      },
                                      import("better-auth").$strip
                                   >;
                                   use: ((
                                      inputContext: import("better-call").MiddlewareInputContext<
                                         import("better-call").MiddlewareOptions
                                      >,
                                   ) => Promise<{
                                      session: {
                                         session: Record<string, any> & {
                                            id: string;
                                            createdAt: Date;
                                            updatedAt: Date;
                                            userId: string;
                                            expiresAt: Date;
                                            token: string;
                                            ipAddress?:
                                               | string
                                               | null
                                               | undefined;
                                            userAgent?:
                                               | string
                                               | null
                                               | undefined;
                                         };
                                         user: Record<string, any> & {
                                            id: string;
                                            createdAt: Date;
                                            updatedAt: Date;
                                            email: string;
                                            emailVerified: boolean;
                                            name: string;
                                            image?: string | null | undefined;
                                         };
                                      };
                                   }>)[];
                                   metadata: {
                                      openapi: {
                                         description: string;
                                         requestBody: {
                                            content: {
                                               "application/json": {
                                                  schema: {
                                                     type: "object";
                                                     properties: {
                                                        keyId: {
                                                           type: string;
                                                           description: string;
                                                        };
                                                     };
                                                     required: string[];
                                                  };
                                               };
                                            };
                                         };
                                         responses: {
                                            "200": {
                                               description: string;
                                               content: {
                                                  "application/json": {
                                                     schema: {
                                                        type: "object";
                                                        properties: {
                                                           success: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                        };
                                                        required: string[];
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   };
                                },
                                {
                                   success: boolean;
                                }
                             >;
                             listApiKeys: import("better-call").StrictEndpoint<
                                "/api-key/list",
                                {
                                   method: "GET";
                                   use: ((
                                      inputContext: import("better-call").MiddlewareInputContext<
                                         import("better-call").MiddlewareOptions
                                      >,
                                   ) => Promise<{
                                      session: {
                                         session: Record<string, any> & {
                                            id: string;
                                            createdAt: Date;
                                            updatedAt: Date;
                                            userId: string;
                                            expiresAt: Date;
                                            token: string;
                                            ipAddress?:
                                               | string
                                               | null
                                               | undefined;
                                            userAgent?:
                                               | string
                                               | null
                                               | undefined;
                                         };
                                         user: Record<string, any> & {
                                            id: string;
                                            createdAt: Date;
                                            updatedAt: Date;
                                            email: string;
                                            emailVerified: boolean;
                                            name: string;
                                            image?: string | null | undefined;
                                         };
                                      };
                                   }>)[];
                                   query: import("zod").ZodOptional<
                                      import("zod").ZodObject<
                                         {
                                            configId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            organizationId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            limit: import("zod").ZodOptional<
                                               import("zod").ZodCoercedNumber<unknown>
                                            >;
                                            offset: import("zod").ZodOptional<
                                               import("zod").ZodCoercedNumber<unknown>
                                            >;
                                            sortBy: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            sortDirection: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  asc: "asc";
                                                  desc: "desc";
                                               }>
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >
                                   >;
                                   metadata: {
                                      openapi: {
                                         description: string;
                                         responses: {
                                            "200": {
                                               description: string;
                                               content: {
                                                  "application/json": {
                                                     schema: {
                                                        type: "object";
                                                        properties: {
                                                           apiKeys: {
                                                              type: string;
                                                              items: {
                                                                 type: string;
                                                                 properties: {
                                                                    id: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    name: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    start: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    prefix: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    userId: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    refillInterval: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    refillAmount: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    lastRefillAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    enabled: {
                                                                       type: string;
                                                                       description: string;
                                                                       default: boolean;
                                                                    };
                                                                    rateLimitEnabled: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    rateLimitTimeWindow: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    rateLimitMax: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    requestCount: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    remaining: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    lastRequest: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    expiresAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    createdAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                    updatedAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                    metadata: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       additionalProperties: boolean;
                                                                       description: string;
                                                                    };
                                                                    permissions: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                 };
                                                                 required: string[];
                                                              };
                                                           };
                                                           total: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                           limit: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                           offset: {
                                                              type: string;
                                                              nullable: boolean;
                                                              description: string;
                                                           };
                                                        };
                                                        required: string[];
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   };
                                },
                                {
                                   apiKeys: {
                                      metadata: Record<string, any> | null;
                                      permissions: {
                                         [key: string]: string[];
                                      } | null;
                                      id: string;
                                      configId: string;
                                      name: string | null;
                                      start: string | null;
                                      prefix: string | null;
                                      referenceId: string;
                                      refillInterval: number | null;
                                      refillAmount: number | null;
                                      lastRefillAt: Date | null;
                                      enabled: boolean;
                                      rateLimitEnabled: boolean;
                                      rateLimitTimeWindow: number | null;
                                      rateLimitMax: number | null;
                                      requestCount: number;
                                      remaining: number | null;
                                      lastRequest: Date | null;
                                      expiresAt: Date | null;
                                      createdAt: Date;
                                      updatedAt: Date;
                                   }[];
                                   total: number;
                                   limit: number | undefined;
                                   offset: number | undefined;
                                }
                             >;
                             deleteAllExpiredApiKeys: import("better-call").StrictEndpoint<
                                string,
                                {
                                   method: "POST";
                                },
                                {
                                   success: boolean;
                                   error: unknown;
                                }
                             >;
                          };
                          schema: {
                             apikey: {
                                fields: {
                                   configId: {
                                      type: "string";
                                      required: true;
                                      defaultValue: string;
                                      input: false;
                                      index: true;
                                   };
                                   name: {
                                      type: "string";
                                      required: false;
                                      input: false;
                                   };
                                   start: {
                                      type: "string";
                                      required: false;
                                      input: false;
                                   };
                                   referenceId: {
                                      type: "string";
                                      required: true;
                                      input: false;
                                      index: true;
                                   };
                                   prefix: {
                                      type: "string";
                                      required: false;
                                      input: false;
                                   };
                                   key: {
                                      type: "string";
                                      required: true;
                                      input: false;
                                      index: true;
                                   };
                                   refillInterval: {
                                      type: "number";
                                      required: false;
                                      input: false;
                                   };
                                   refillAmount: {
                                      type: "number";
                                      required: false;
                                      input: false;
                                   };
                                   lastRefillAt: {
                                      type: "date";
                                      required: false;
                                      input: false;
                                   };
                                   enabled: {
                                      type: "boolean";
                                      required: false;
                                      input: false;
                                      defaultValue: true;
                                   };
                                   rateLimitEnabled: {
                                      type: "boolean";
                                      required: false;
                                      input: false;
                                      defaultValue: true;
                                   };
                                   rateLimitTimeWindow: {
                                      type: "number";
                                      required: false;
                                      input: false;
                                      defaultValue: number;
                                   };
                                   rateLimitMax: {
                                      type: "number";
                                      required: false;
                                      input: false;
                                      defaultValue: number;
                                   };
                                   requestCount: {
                                      type: "number";
                                      required: false;
                                      input: false;
                                      defaultValue: number;
                                   };
                                   remaining: {
                                      type: "number";
                                      required: false;
                                      input: false;
                                   };
                                   lastRequest: {
                                      type: "date";
                                      required: false;
                                      input: false;
                                   };
                                   expiresAt: {
                                      type: "date";
                                      required: false;
                                      input: false;
                                   };
                                   createdAt: {
                                      type: "date";
                                      required: true;
                                      input: false;
                                   };
                                   updatedAt: {
                                      type: "date";
                                      required: true;
                                      input: false;
                                   };
                                   permissions: {
                                      type: "string";
                                      required: false;
                                      input: false;
                                   };
                                   metadata: {
                                      type: "string";
                                      required: false;
                                      input: true;
                                      transform: {
                                         input(
                                            value: import("better-auth").DBPrimitive,
                                         ): string;
                                         output(
                                            value: import("better-auth").DBPrimitive,
                                         ): any;
                                      };
                                   };
                                };
                             };
                          };
                          configurations: (import("@better-auth/api-key").ApiKeyConfigurationOptions &
                             Required<
                                Pick<
                                   import("@better-auth/api-key").ApiKeyConfigurationOptions,
                                   | "apiKeyHeaders"
                                   | "defaultKeyLength"
                                   | "deferUpdates"
                                   | "disableKeyHashing"
                                   | "enableMetadata"
                                   | "enableSessionForAPIKeys"
                                   | "fallbackToDatabase"
                                   | "keyExpiration"
                                   | "maximumNameLength"
                                   | "maximumPrefixLength"
                                   | "minimumNameLength"
                                   | "minimumPrefixLength"
                                   | "rateLimit"
                                   | "requireName"
                                   | "startingCharactersConfig"
                                   | "storage"
                                >
                             > & {
                                keyExpiration: Required<{
                                   defaultExpiresIn?: number | null | undefined;
                                   disableCustomExpiresTime?:
                                      | boolean
                                      | undefined;
                                   minExpiresIn?: number | undefined;
                                   maxExpiresIn?: number | undefined;
                                }>;
                                startingCharactersConfig: Required<{
                                   shouldStore?: boolean | undefined;
                                   charactersLength?: number | undefined;
                                }>;
                                rateLimit: Required<{
                                   enabled?: boolean | undefined;
                                   timeWindow?: number | undefined;
                                   maxRequests?: number | undefined;
                                }>;
                             })[];
                       }
                     | {
                          id: "two-factor";
                          $InferServerPlugin: {
                             id: "two-factor";
                             endpoints: {
                                enableTwoFactor: import("better-call").StrictEndpoint<
                                   "/two-factor/enable",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            password: import("zod").ZodString;
                                            issuer: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            session: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                            user: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               email: string;
                                               emailVerified: boolean;
                                               name: string;
                                               image?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              totpURI: {
                                                                 type: string;
                                                                 description: string;
                                                              };
                                                              backupCodes: {
                                                                 type: string;
                                                                 items: {
                                                                    type: string;
                                                                 };
                                                                 description: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      totpURI: string;
                                      backupCodes: string[];
                                   }
                                >;
                                disableTwoFactor: import("better-call").StrictEndpoint<
                                   "/two-factor/disable",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            password: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            session: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                            user: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               email: string;
                                               emailVerified: boolean;
                                               name: string;
                                               image?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      status: boolean;
                                   }
                                >;
                                verifyBackupCode: import("better-call").StrictEndpoint<
                                   "/two-factor/verify-backup-code",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            code: import("zod").ZodString;
                                            disableSession: import("zod").ZodOptional<
                                               import("zod").ZodBoolean
                                            >;
                                            trustDevice: import("zod").ZodOptional<
                                               import("zod").ZodBoolean
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            description: string;
                                            responses: {
                                               "200": {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 type: string;
                                                                 properties: {
                                                                    id: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    email: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    emailVerified: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    name: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    image: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    twoFactorEnabled: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    createdAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                    updatedAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                 };
                                                                 required: string[];
                                                                 description: string;
                                                              };
                                                              session: {
                                                                 type: string;
                                                                 properties: {
                                                                    token: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    userId: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    createdAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                    expiresAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                 };
                                                                 required: string[];
                                                                 description: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      token: string | undefined;
                                      user:
                                         | import("better-auth/plugins").UserWithTwoFactor
                                         | (Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              email: string;
                                              emailVerified: boolean;
                                              name: string;
                                              image?: string | null | undefined;
                                           });
                                   }
                                >;
                                generateBackupCodes: import("better-call").StrictEndpoint<
                                   "/two-factor/generate-backup-codes",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            password: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            session: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                            user: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               email: string;
                                               emailVerified: boolean;
                                               name: string;
                                               image?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            description: string;
                                            responses: {
                                               "200": {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                                 description: string;
                                                                 enum: boolean[];
                                                              };
                                                              backupCodes: {
                                                                 type: string;
                                                                 items: {
                                                                    type: string;
                                                                 };
                                                                 description: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      status: boolean;
                                      backupCodes: string[];
                                   }
                                >;
                                viewBackupCodes: import("better-call").StrictEndpoint<
                                   string,
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                   },
                                   {
                                      status: boolean;
                                      backupCodes: string[];
                                   }
                                >;
                                sendTwoFactorOTP: import("better-call").StrictEndpoint<
                                   "/two-factor/send-otp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodOptional<
                                         import("zod").ZodObject<
                                            {
                                               trustDevice: import("zod").ZodOptional<
                                                  import("zod").ZodBoolean
                                               >;
                                            },
                                            import("better-auth").$strip
                                         >
                                      >;
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      status: boolean;
                                   }
                                >;
                                verifyTwoFactorOTP: import("better-call").StrictEndpoint<
                                   "/two-factor/verify-otp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            code: import("zod").ZodString;
                                            trustDevice: import("zod").ZodOptional<
                                               import("zod").ZodBoolean
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               "200": {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              token: {
                                                                 type: string;
                                                                 description: string;
                                                              };
                                                              user: {
                                                                 type: string;
                                                                 properties: {
                                                                    id: {
                                                                       type: string;
                                                                       description: string;
                                                                    };
                                                                    email: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    emailVerified: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    name: {
                                                                       type: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    image: {
                                                                       type: string;
                                                                       format: string;
                                                                       nullable: boolean;
                                                                       description: string;
                                                                    };
                                                                    createdAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                    updatedAt: {
                                                                       type: string;
                                                                       format: string;
                                                                       description: string;
                                                                    };
                                                                 };
                                                                 required: string[];
                                                                 description: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   | {
                                        token: string;
                                        user: import("better-auth/plugins").UserWithTwoFactor;
                                     }
                                   | {
                                        token: string;
                                        user: Record<string, any> & {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        };
                                     }
                                >;
                                generateTOTP: import("better-call").StrictEndpoint<
                                   string,
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            secret: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              code: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      code: string;
                                   }
                                >;
                                getTOTPURI: import("better-call").StrictEndpoint<
                                   "/two-factor/get-totp-uri",
                                   {
                                      method: "POST";
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            session: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                            user: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               email: string;
                                               emailVerified: boolean;
                                               name: string;
                                               image?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      body: import("zod").ZodObject<
                                         {
                                            password: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              totpURI: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      totpURI: string;
                                   }
                                >;
                                verifyTOTP: import("better-call").StrictEndpoint<
                                   "/two-factor/verify-totp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            code: import("zod").ZodString;
                                            trustDevice: import("zod").ZodOptional<
                                               import("zod").ZodBoolean
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   | {
                                        token: string;
                                        user: import("better-auth/plugins").UserWithTwoFactor;
                                     }
                                   | {
                                        token: string;
                                        user: Record<string, any> & {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        };
                                     }
                                >;
                             };
                             options: NoInfer<
                                import("better-auth/plugins").TwoFactorOptions
                             >;
                             hooks: {
                                after: {
                                   matcher(
                                      context: import("better-auth").HookEndpointContext,
                                   ): boolean;
                                   handler: (
                                      inputContext: import("better-call").MiddlewareInputContext<
                                         import("better-call").MiddlewareOptions
                                      >,
                                   ) => Promise<
                                      | {
                                           twoFactorRedirect: boolean;
                                        }
                                      | undefined
                                   >;
                                }[];
                             };
                             schema: {
                                user: {
                                   fields: {
                                      twoFactorEnabled: {
                                         type: "boolean";
                                         required: false;
                                         defaultValue: false;
                                         input: false;
                                      };
                                   };
                                };
                                twoFactor: {
                                   fields: {
                                      secret: {
                                         type: "string";
                                         required: true;
                                         returned: false;
                                         index: true;
                                      };
                                      backupCodes: {
                                         type: "string";
                                         required: true;
                                         returned: false;
                                      };
                                      userId: {
                                         type: "string";
                                         required: true;
                                         returned: false;
                                         references: {
                                            model: string;
                                            field: string;
                                         };
                                         index: true;
                                      };
                                   };
                                };
                             };
                             rateLimit: {
                                pathMatcher(path: string): boolean;
                                window: number;
                                max: number;
                             }[];
                             $ERROR_CODES: {
                                OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
                                OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
                                TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
                                TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
                                BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
                                INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
                                INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
                                TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
                                INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
                             };
                          };
                          atomListeners: {
                             matcher: (path: string) => boolean;
                             signal: "$sessionSignal";
                          }[];
                          pathMethods: {
                             "/two-factor/disable": "POST";
                             "/two-factor/enable": "POST";
                             "/two-factor/send-otp": "POST";
                             "/two-factor/generate-backup-codes": "POST";
                             "/two-factor/get-totp-uri": "POST";
                             "/two-factor/verify-totp": "POST";
                             "/two-factor/verify-otp": "POST";
                             "/two-factor/verify-backup-code": "POST";
                          };
                          fetchPlugins: {
                             id: string;
                             name: string;
                             hooks: {
                                onSuccess(
                                   context: import("@better-fetch/fetch").SuccessContext<any>,
                                ): Promise<void>;
                             };
                          }[];
                          $ERROR_CODES: {
                             OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
                             OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
                             TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
                             TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
                             BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
                             INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
                             INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
                             TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
                             INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
                          };
                       }
                     | {
                          id: "stripe-client";
                          $InferServerPlugin: {
                             id: "stripe";
                             endpoints: {
                                stripeWebhook: import("better-call").StrictEndpoint<
                                   "/stripe/webhook",
                                   {
                                      method: "POST";
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                         scope: "server";
                                      };
                                      cloneRequest: true;
                                      disableBody: true;
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                             } & {
                                upgradeSubscription: import("better-call").StrictEndpoint<
                                   "/subscription/upgrade",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            plan: import("zod").ZodString;
                                            annual: import("zod").ZodOptional<
                                               import("zod").ZodBoolean
                                            >;
                                            referenceId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            subscriptionId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            customerType: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  user: "user";
                                                  organization: "organization";
                                               }>
                                            >;
                                            metadata: import("zod").ZodOptional<
                                               import("zod").ZodRecord<
                                                  import("zod").ZodString,
                                                  import("zod").ZodAny
                                               >
                                            >;
                                            seats: import("zod").ZodOptional<
                                               import("zod").ZodNumber
                                            >;
                                            locale: import("zod").ZodOptional<
                                               import("zod").ZodCustom<
                                                  import("stripe").Stripe.Checkout.Session.Locale,
                                                  import("stripe").Stripe.Checkout.Session.Locale
                                               >
                                            >;
                                            successUrl: import("zod").ZodDefault<
                                               import("zod").ZodString
                                            >;
                                            cancelUrl: import("zod").ZodDefault<
                                               import("zod").ZodString
                                            >;
                                            returnUrl: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            scheduleAtPeriodEnd: import("zod").ZodDefault<
                                               import("zod").ZodBoolean
                                            >;
                                            disableRedirect: import("zod").ZodDefault<
                                               import("zod").ZodBoolean
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                      };
                                      use: (
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<{
                                                 use: ((
                                                    inputContext: import("better-call").MiddlewareInputContext<
                                                       import("better-call").MiddlewareOptions
                                                    >,
                                                 ) => Promise<{
                                                    session: {
                                                       session: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          userId: string;
                                                          expiresAt: Date;
                                                          token: string;
                                                          ipAddress?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                          userAgent?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                       user: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          email: string;
                                                          emailVerified: boolean;
                                                          name: string;
                                                          image?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                    };
                                                 }>)[];
                                              }>,
                                           ) => Promise<{
                                              session: import("@better-auth/stripe").StripeCtxSession;
                                           }>)
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<
                                                 import("better-call").MiddlewareOptions
                                              >,
                                           ) => Promise<void>)
                                      )[];
                                   },
                                   | {
                                        url: string;
                                        redirect: boolean;
                                     }
                                   | {
                                        redirect: boolean;
                                        id: string;
                                        object: "checkout.session";
                                        adaptive_pricing:
                                           | import("stripe").Stripe.Checkout.Session.AdaptivePricing
                                           | null;
                                        after_expiration:
                                           | import("stripe").Stripe.Checkout.Session.AfterExpiration
                                           | null;
                                        allow_promotion_codes: boolean | null;
                                        amount_subtotal: number | null;
                                        amount_total: number | null;
                                        automatic_tax: import("stripe").Stripe.Checkout.Session.AutomaticTax;
                                        billing_address_collection:
                                           | import("stripe").Stripe.Checkout.Session.BillingAddressCollection
                                           | null;
                                        branding_settings?:
                                           | import("stripe").Stripe.Checkout.Session.BrandingSettings
                                           | undefined;
                                        cancel_url: string | null;
                                        client_reference_id: string | null;
                                        client_secret: string | null;
                                        collected_information:
                                           | import("stripe").Stripe.Checkout.Session.CollectedInformation
                                           | null;
                                        consent:
                                           | import("stripe").Stripe.Checkout.Session.Consent
                                           | null;
                                        consent_collection:
                                           | import("stripe").Stripe.Checkout.Session.ConsentCollection
                                           | null;
                                        created: number;
                                        currency: string | null;
                                        currency_conversion:
                                           | import("stripe").Stripe.Checkout.Session.CurrencyConversion
                                           | null;
                                        custom_fields: import("stripe").Stripe.Checkout.Session.CustomField[];
                                        custom_text: import("stripe").Stripe.Checkout.Session.CustomText;
                                        customer:
                                           | string
                                           | import("stripe").Stripe.Customer
                                           | import("stripe").Stripe.DeletedCustomer
                                           | null;
                                        customer_account: string | null;
                                        customer_creation:
                                           | import("stripe").Stripe.Checkout.Session.CustomerCreation
                                           | null;
                                        customer_details:
                                           | import("stripe").Stripe.Checkout.Session.CustomerDetails
                                           | null;
                                        customer_email: string | null;
                                        discounts:
                                           | import("stripe").Stripe.Checkout.Session.Discount[]
                                           | null;
                                        excluded_payment_method_types?:
                                           | string[]
                                           | undefined;
                                        expires_at: number;
                                        invoice:
                                           | string
                                           | import("stripe").Stripe.Invoice
                                           | null;
                                        invoice_creation:
                                           | import("stripe").Stripe.Checkout.Session.InvoiceCreation
                                           | null;
                                        line_items?:
                                           | import("stripe").Stripe.ApiList<
                                                import("stripe").Stripe.LineItem
                                             >
                                           | undefined;
                                        livemode: boolean;
                                        locale:
                                           | import("stripe").Stripe.Checkout.Session.Locale
                                           | null;
                                        metadata:
                                           | import("stripe").Stripe.Metadata
                                           | null;
                                        mode: import("stripe").Stripe.Checkout.Session.Mode;
                                        name_collection?:
                                           | import("stripe").Stripe.Checkout.Session.NameCollection
                                           | undefined;
                                        optional_items?:
                                           | import("stripe").Stripe.Checkout.Session.OptionalItem[]
                                           | null
                                           | undefined;
                                        origin_context:
                                           | import("stripe").Stripe.Checkout.Session.OriginContext
                                           | null;
                                        payment_intent:
                                           | string
                                           | import("stripe").Stripe.PaymentIntent
                                           | null;
                                        payment_link:
                                           | string
                                           | import("stripe").Stripe.PaymentLink
                                           | null;
                                        payment_method_collection:
                                           | import("stripe").Stripe.Checkout.Session.PaymentMethodCollection
                                           | null;
                                        payment_method_configuration_details:
                                           | import("stripe").Stripe.Checkout.Session.PaymentMethodConfigurationDetails
                                           | null;
                                        payment_method_options:
                                           | import("stripe").Stripe.Checkout.Session.PaymentMethodOptions
                                           | null;
                                        payment_method_types: string[];
                                        payment_status: import("stripe").Stripe.Checkout.Session.PaymentStatus;
                                        permissions:
                                           | import("stripe").Stripe.Checkout.Session.Permissions
                                           | null;
                                        phone_number_collection?:
                                           | import("stripe").Stripe.Checkout.Session.PhoneNumberCollection
                                           | undefined;
                                        presentment_details?:
                                           | import("stripe").Stripe.Checkout.Session.PresentmentDetails
                                           | undefined;
                                        recovered_from: string | null;
                                        redirect_on_completion?:
                                           | import("stripe").Stripe.Checkout.Session.RedirectOnCompletion
                                           | undefined;
                                        return_url?: string | undefined;
                                        saved_payment_method_options:
                                           | import("stripe").Stripe.Checkout.Session.SavedPaymentMethodOptions
                                           | null;
                                        setup_intent:
                                           | string
                                           | import("stripe").Stripe.SetupIntent
                                           | null;
                                        shipping_address_collection:
                                           | import("stripe").Stripe.Checkout.Session.ShippingAddressCollection
                                           | null;
                                        shipping_cost:
                                           | import("stripe").Stripe.Checkout.Session.ShippingCost
                                           | null;
                                        shipping_options: import("stripe").Stripe.Checkout.Session.ShippingOption[];
                                        status:
                                           | import("stripe").Stripe.Checkout.Session.Status
                                           | null;
                                        submit_type:
                                           | import("stripe").Stripe.Checkout.Session.SubmitType
                                           | null;
                                        subscription:
                                           | string
                                           | import("stripe").Stripe.Subscription
                                           | null;
                                        success_url: string | null;
                                        tax_id_collection?:
                                           | import("stripe").Stripe.Checkout.Session.TaxIdCollection
                                           | undefined;
                                        total_details:
                                           | import("stripe").Stripe.Checkout.Session.TotalDetails
                                           | null;
                                        ui_mode:
                                           | import("stripe").Stripe.Checkout.Session.UiMode
                                           | null;
                                        url: string | null;
                                        wallet_options:
                                           | import("stripe").Stripe.Checkout.Session.WalletOptions
                                           | null;
                                        lastResponse: {
                                           headers: {
                                              [key: string]: string;
                                           };
                                           requestId: string;
                                           statusCode: number;
                                           apiVersion?: string | undefined;
                                           idempotencyKey?: string | undefined;
                                           stripeAccount?: string | undefined;
                                        };
                                     }
                                >;
                                cancelSubscription: import("better-call").StrictEndpoint<
                                   "/subscription/cancel",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            referenceId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            subscriptionId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            customerType: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  user: "user";
                                                  organization: "organization";
                                               }>
                                            >;
                                            returnUrl: import("zod").ZodString;
                                            disableRedirect: import("zod").ZodDefault<
                                               import("zod").ZodBoolean
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                      };
                                      use: (
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<{
                                                 use: ((
                                                    inputContext: import("better-call").MiddlewareInputContext<
                                                       import("better-call").MiddlewareOptions
                                                    >,
                                                 ) => Promise<{
                                                    session: {
                                                       session: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          userId: string;
                                                          expiresAt: Date;
                                                          token: string;
                                                          ipAddress?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                          userAgent?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                       user: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          email: string;
                                                          emailVerified: boolean;
                                                          name: string;
                                                          image?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                    };
                                                 }>)[];
                                              }>,
                                           ) => Promise<{
                                              session: import("@better-auth/stripe").StripeCtxSession;
                                           }>)
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<
                                                 import("better-call").MiddlewareOptions
                                              >,
                                           ) => Promise<void>)
                                      )[];
                                   },
                                   {
                                      url: string;
                                      redirect: boolean;
                                   }
                                >;
                                restoreSubscription: import("better-call").StrictEndpoint<
                                   "/subscription/restore",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            referenceId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            subscriptionId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            customerType: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  user: "user";
                                                  organization: "organization";
                                               }>
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                      };
                                      use: (
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<{
                                                 use: ((
                                                    inputContext: import("better-call").MiddlewareInputContext<
                                                       import("better-call").MiddlewareOptions
                                                    >,
                                                 ) => Promise<{
                                                    session: {
                                                       session: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          userId: string;
                                                          expiresAt: Date;
                                                          token: string;
                                                          ipAddress?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                          userAgent?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                       user: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          email: string;
                                                          emailVerified: boolean;
                                                          name: string;
                                                          image?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                    };
                                                 }>)[];
                                              }>,
                                           ) => Promise<{
                                              session: import("@better-auth/stripe").StripeCtxSession;
                                           }>)
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<
                                                 import("better-call").MiddlewareOptions
                                              >,
                                           ) => Promise<void>)
                                      )[];
                                   },
                                   import("stripe").Stripe.Response<
                                      import("stripe").Stripe.Subscription
                                   >
                                >;
                                listActiveSubscriptions: import("better-call").StrictEndpoint<
                                   "/subscription/list",
                                   {
                                      method: "GET";
                                      query: import("zod").ZodOptional<
                                         import("zod").ZodObject<
                                            {
                                               referenceId: import("zod").ZodOptional<
                                                  import("zod").ZodString
                                               >;
                                               customerType: import("zod").ZodOptional<
                                                  import("zod").ZodEnum<{
                                                     user: "user";
                                                     organization: "organization";
                                                  }>
                                               >;
                                            },
                                            import("better-auth").$strip
                                         >
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                      };
                                      use: (
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<{
                                                 use: ((
                                                    inputContext: import("better-call").MiddlewareInputContext<
                                                       import("better-call").MiddlewareOptions
                                                    >,
                                                 ) => Promise<{
                                                    session: {
                                                       session: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          userId: string;
                                                          expiresAt: Date;
                                                          token: string;
                                                          ipAddress?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                          userAgent?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                       user: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          email: string;
                                                          emailVerified: boolean;
                                                          name: string;
                                                          image?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                    };
                                                 }>)[];
                                              }>,
                                           ) => Promise<{
                                              session: import("@better-auth/stripe").StripeCtxSession;
                                           }>)
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<
                                                 import("better-call").MiddlewareOptions
                                              >,
                                           ) => Promise<void>)
                                      )[];
                                   },
                                   {
                                      limits:
                                         | Record<string, unknown>
                                         | undefined;
                                      priceId: string | undefined;
                                      id: string;
                                      plan: string;
                                      stripeCustomerId?: string | undefined;
                                      stripeSubscriptionId?: string | undefined;
                                      trialStart?: Date | undefined;
                                      trialEnd?: Date | undefined;
                                      referenceId: string;
                                      status:
                                         | "active"
                                         | "canceled"
                                         | "incomplete"
                                         | "incomplete_expired"
                                         | "past_due"
                                         | "paused"
                                         | "trialing"
                                         | "unpaid";
                                      periodStart?: Date | undefined;
                                      periodEnd?: Date | undefined;
                                      cancelAtPeriodEnd?: boolean | undefined;
                                      cancelAt?: Date | undefined;
                                      canceledAt?: Date | undefined;
                                      endedAt?: Date | undefined;
                                      groupId?: string | undefined;
                                      seats?: number | undefined;
                                      billingInterval?:
                                         | "day"
                                         | "month"
                                         | "week"
                                         | "year"
                                         | undefined;
                                      stripeScheduleId?: string | undefined;
                                   }[]
                                >;
                                subscriptionSuccess: import("better-call").StrictEndpoint<
                                   "/subscription/success",
                                   {
                                      method: "GET";
                                      query: import("zod").ZodOptional<
                                         import("zod").ZodRecord<
                                            import("zod").ZodString,
                                            import("zod").ZodAny
                                         >
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                      };
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<void>)[];
                                   },
                                   never
                                >;
                                createBillingPortal: import("better-call").StrictEndpoint<
                                   "/subscription/billing-portal",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            locale: import("zod").ZodOptional<
                                               import("zod").ZodCustom<
                                                  import("stripe").Stripe.Checkout.Session.Locale,
                                                  import("stripe").Stripe.Checkout.Session.Locale
                                               >
                                            >;
                                            referenceId: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            customerType: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  user: "user";
                                                  organization: "organization";
                                               }>
                                            >;
                                            returnUrl: import("zod").ZodDefault<
                                               import("zod").ZodString
                                            >;
                                            disableRedirect: import("zod").ZodDefault<
                                               import("zod").ZodBoolean
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                         };
                                      };
                                      use: (
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<{
                                                 use: ((
                                                    inputContext: import("better-call").MiddlewareInputContext<
                                                       import("better-call").MiddlewareOptions
                                                    >,
                                                 ) => Promise<{
                                                    session: {
                                                       session: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          userId: string;
                                                          expiresAt: Date;
                                                          token: string;
                                                          ipAddress?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                          userAgent?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                       user: Record<
                                                          string,
                                                          any
                                                       > & {
                                                          id: string;
                                                          createdAt: Date;
                                                          updatedAt: Date;
                                                          email: string;
                                                          emailVerified: boolean;
                                                          name: string;
                                                          image?:
                                                             | string
                                                             | null
                                                             | undefined;
                                                       };
                                                    };
                                                 }>)[];
                                              }>,
                                           ) => Promise<{
                                              session: import("@better-auth/stripe").StripeCtxSession;
                                           }>)
                                         | ((
                                              inputContext: import("better-call").MiddlewareInputContext<
                                                 import("better-call").MiddlewareOptions
                                              >,
                                           ) => Promise<void>)
                                      )[];
                                   },
                                   {
                                      url: string;
                                      redirect: boolean;
                                   }
                                >;
                             };
                             init(ctx: import("better-auth").AuthContext):
                                | {
                                     options: {
                                        databaseHooks: {
                                           user: {
                                              create: {
                                                 after(
                                                    user: {
                                                       id: string;
                                                       createdAt: Date;
                                                       updatedAt: Date;
                                                       email: string;
                                                       emailVerified: boolean;
                                                       name: string;
                                                       image?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                    } & import("@better-auth/stripe").WithStripeCustomerId,
                                                    ctx:
                                                       | import("better-auth").GenericEndpointContext
                                                       | null,
                                                 ): Promise<void>;
                                              };
                                              update: {
                                                 after(
                                                    user: {
                                                       id: string;
                                                       createdAt: Date;
                                                       updatedAt: Date;
                                                       email: string;
                                                       emailVerified: boolean;
                                                       name: string;
                                                       image?:
                                                          | string
                                                          | null
                                                          | undefined;
                                                    } & import("@better-auth/stripe").WithStripeCustomerId,
                                                    ctx:
                                                       | import("better-auth").GenericEndpointContext
                                                       | null,
                                                 ): Promise<void>;
                                              };
                                           };
                                        };
                                     };
                                  }
                                | undefined;
                             schema: {
                                user: {
                                   fields: {
                                      stripeCustomerId: {
                                         type: "string";
                                         required: false;
                                      };
                                   };
                                };
                             } & {
                                subscription: {
                                   fields: {
                                      plan: {
                                         type: "string";
                                         required: true;
                                      };
                                      referenceId: {
                                         type: "string";
                                         required: true;
                                      };
                                      stripeCustomerId: {
                                         type: "string";
                                         required: false;
                                      };
                                      stripeSubscriptionId: {
                                         type: "string";
                                         required: false;
                                      };
                                      status: {
                                         type: "string";
                                         defaultValue: string;
                                      };
                                      periodStart: {
                                         type: "date";
                                         required: false;
                                      };
                                      periodEnd: {
                                         type: "date";
                                         required: false;
                                      };
                                      trialStart: {
                                         type: "date";
                                         required: false;
                                      };
                                      trialEnd: {
                                         type: "date";
                                         required: false;
                                      };
                                      cancelAtPeriodEnd: {
                                         type: "boolean";
                                         required: false;
                                         defaultValue: false;
                                      };
                                      cancelAt: {
                                         type: "date";
                                         required: false;
                                      };
                                      canceledAt: {
                                         type: "date";
                                         required: false;
                                      };
                                      endedAt: {
                                         type: "date";
                                         required: false;
                                      };
                                      seats: {
                                         type: "number";
                                         required: false;
                                      };
                                      billingInterval: {
                                         type: "string";
                                         required: false;
                                      };
                                      stripeScheduleId: {
                                         type: "string";
                                         required: false;
                                      };
                                   };
                                };
                             };
                             options: NoInfer<{
                                stripeClient: any;
                                stripeWebhookSecret: string;
                                subscription: {
                                   enabled: true;
                                   plans: import("@better-auth/stripe").StripePlan[];
                                };
                             }>;
                             $ERROR_CODES: {
                                UNAUTHORIZED: import("better-auth").RawError<"UNAUTHORIZED">;
                                INVALID_REQUEST_BODY: import("better-auth").RawError<"INVALID_REQUEST_BODY">;
                                SUBSCRIPTION_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_NOT_FOUND">;
                                SUBSCRIPTION_PLAN_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
                                ALREADY_SUBSCRIBED_PLAN: import("better-auth").RawError<"ALREADY_SUBSCRIBED_PLAN">;
                                REFERENCE_ID_NOT_ALLOWED: import("better-auth").RawError<"REFERENCE_ID_NOT_ALLOWED">;
                                CUSTOMER_NOT_FOUND: import("better-auth").RawError<"CUSTOMER_NOT_FOUND">;
                                UNABLE_TO_CREATE_CUSTOMER: import("better-auth").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
                                UNABLE_TO_CREATE_BILLING_PORTAL: import("better-auth").RawError<"UNABLE_TO_CREATE_BILLING_PORTAL">;
                                STRIPE_SIGNATURE_NOT_FOUND: import("better-auth").RawError<"STRIPE_SIGNATURE_NOT_FOUND">;
                                STRIPE_WEBHOOK_SECRET_NOT_FOUND: import("better-auth").RawError<"STRIPE_WEBHOOK_SECRET_NOT_FOUND">;
                                STRIPE_WEBHOOK_ERROR: import("better-auth").RawError<"STRIPE_WEBHOOK_ERROR">;
                                FAILED_TO_CONSTRUCT_STRIPE_EVENT: import("better-auth").RawError<"FAILED_TO_CONSTRUCT_STRIPE_EVENT">;
                                FAILED_TO_FETCH_PLANS: import("better-auth").RawError<"FAILED_TO_FETCH_PLANS">;
                                EMAIL_VERIFICATION_REQUIRED: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED">;
                                SUBSCRIPTION_NOT_ACTIVE: import("better-auth").RawError<"SUBSCRIPTION_NOT_ACTIVE">;
                                SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: import("better-auth").RawError<"SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION">;
                                SUBSCRIPTION_NOT_PENDING_CHANGE: import("better-auth").RawError<"SUBSCRIPTION_NOT_PENDING_CHANGE">;
                                ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
                                ORGANIZATION_SUBSCRIPTION_NOT_ENABLED: import("better-auth").RawError<"ORGANIZATION_SUBSCRIPTION_NOT_ENABLED">;
                                AUTHORIZE_REFERENCE_REQUIRED: import("better-auth").RawError<"AUTHORIZE_REFERENCE_REQUIRED">;
                                ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION: import("better-auth").RawError<"ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION">;
                                ORGANIZATION_REFERENCE_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_REFERENCE_ID_REQUIRED">;
                             };
                          };
                          pathMethods: {
                             "/subscription/billing-portal": "POST";
                             "/subscription/restore": "POST";
                          };
                          $ERROR_CODES: {
                             UNAUTHORIZED: import("better-auth").RawError<"UNAUTHORIZED">;
                             INVALID_REQUEST_BODY: import("better-auth").RawError<"INVALID_REQUEST_BODY">;
                             SUBSCRIPTION_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_NOT_FOUND">;
                             SUBSCRIPTION_PLAN_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
                             ALREADY_SUBSCRIBED_PLAN: import("better-auth").RawError<"ALREADY_SUBSCRIBED_PLAN">;
                             REFERENCE_ID_NOT_ALLOWED: import("better-auth").RawError<"REFERENCE_ID_NOT_ALLOWED">;
                             CUSTOMER_NOT_FOUND: import("better-auth").RawError<"CUSTOMER_NOT_FOUND">;
                             UNABLE_TO_CREATE_CUSTOMER: import("better-auth").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
                             UNABLE_TO_CREATE_BILLING_PORTAL: import("better-auth").RawError<"UNABLE_TO_CREATE_BILLING_PORTAL">;
                             STRIPE_SIGNATURE_NOT_FOUND: import("better-auth").RawError<"STRIPE_SIGNATURE_NOT_FOUND">;
                             STRIPE_WEBHOOK_SECRET_NOT_FOUND: import("better-auth").RawError<"STRIPE_WEBHOOK_SECRET_NOT_FOUND">;
                             STRIPE_WEBHOOK_ERROR: import("better-auth").RawError<"STRIPE_WEBHOOK_ERROR">;
                             FAILED_TO_CONSTRUCT_STRIPE_EVENT: import("better-auth").RawError<"FAILED_TO_CONSTRUCT_STRIPE_EVENT">;
                             FAILED_TO_FETCH_PLANS: import("better-auth").RawError<"FAILED_TO_FETCH_PLANS">;
                             EMAIL_VERIFICATION_REQUIRED: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED">;
                             SUBSCRIPTION_NOT_ACTIVE: import("better-auth").RawError<"SUBSCRIPTION_NOT_ACTIVE">;
                             SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: import("better-auth").RawError<"SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION">;
                             SUBSCRIPTION_NOT_PENDING_CHANGE: import("better-auth").RawError<"SUBSCRIPTION_NOT_PENDING_CHANGE">;
                             ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
                             ORGANIZATION_SUBSCRIPTION_NOT_ENABLED: import("better-auth").RawError<"ORGANIZATION_SUBSCRIPTION_NOT_ENABLED">;
                             AUTHORIZE_REFERENCE_REQUIRED: import("better-auth").RawError<"AUTHORIZE_REFERENCE_REQUIRED">;
                             ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION: import("better-auth").RawError<"ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION">;
                             ORGANIZATION_REFERENCE_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_REFERENCE_ID_REQUIRED">;
                          };
                       }
                     | {
                          id: "additional-fields-client";
                          $InferServerPlugin: {
                             id: "additional-fields";
                             schema: {
                                user: {
                                   fields: {
                                      telemetryConsent: {
                                         defaultValue: false;
                                         input: true;
                                         required: true;
                                         type: "boolean";
                                      };
                                   };
                                };
                                session: {
                                   fields: {};
                                };
                             };
                          };
                       }
                     | {
                          id: "admin-client";
                          $InferServerPlugin: {
                             id: "admin";
                             init(): {
                                options: {
                                   databaseHooks: {
                                      user: {
                                         create: {
                                            before(
                                               user: {
                                                  id: string;
                                                  createdAt: Date;
                                                  updatedAt: Date;
                                                  email: string;
                                                  emailVerified: boolean;
                                                  name: string;
                                                  image?:
                                                     | string
                                                     | null
                                                     | undefined;
                                               } & Record<string, unknown>,
                                            ): Promise<{
                                               data: {
                                                  id: string;
                                                  createdAt: Date;
                                                  updatedAt: Date;
                                                  email: string;
                                                  emailVerified: boolean;
                                                  name: string;
                                                  image?:
                                                     | string
                                                     | null
                                                     | undefined;
                                                  role: string;
                                               };
                                            }>;
                                         };
                                      };
                                      session: {
                                         create: {
                                            before(
                                               session: {
                                                  id: string;
                                                  createdAt: Date;
                                                  updatedAt: Date;
                                                  userId: string;
                                                  expiresAt: Date;
                                                  token: string;
                                                  ipAddress?:
                                                     | string
                                                     | null
                                                     | undefined;
                                                  userAgent?:
                                                     | string
                                                     | null
                                                     | undefined;
                                               } & Record<string, unknown>,
                                               ctx:
                                                  | import("better-auth").GenericEndpointContext
                                                  | null,
                                            ): Promise<void>;
                                         };
                                      };
                                   };
                                };
                             };
                             hooks: {
                                after: {
                                   matcher(
                                      context: import("better-auth").HookEndpointContext,
                                   ): boolean;
                                   handler: (
                                      inputContext: import("better-call").MiddlewareInputContext<
                                         import("better-call").MiddlewareOptions
                                      >,
                                   ) => Promise<
                                      | import("better-auth/plugins").SessionWithImpersonatedBy[]
                                      | undefined
                                   >;
                                }[];
                             };
                             endpoints: {
                                setRole: import("better-call").StrictEndpoint<
                                   "/admin/set-role",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                            role: import("zod").ZodUnion<
                                               readonly [
                                                  import("zod").ZodString,
                                                  import("zod").ZodArray<
                                                     import("zod").ZodString
                                                  >,
                                               ]
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      requireHeaders: true;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                         $Infer: {
                                            body: {
                                               userId: string;
                                               role:
                                                  | "admin"
                                                  | "user"
                                                  | ("admin" | "user")[];
                                            };
                                         };
                                      };
                                   },
                                   {
                                      user: import("better-auth/plugins").UserWithRole;
                                   }
                                >;
                                getUser: import("better-call").StrictEndpoint<
                                   "/admin/get-user",
                                   {
                                      method: "GET";
                                      query: import("zod").ZodObject<
                                         {
                                            id: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   import("better-auth/plugins").UserWithRole
                                >;
                                createUser: import("better-call").StrictEndpoint<
                                   "/admin/create-user",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            password: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            name: import("zod").ZodString;
                                            role: import("zod").ZodOptional<
                                               import("zod").ZodUnion<
                                                  readonly [
                                                     import("zod").ZodString,
                                                     import("zod").ZodArray<
                                                        import("zod").ZodString
                                                     >,
                                                  ]
                                               >
                                            >;
                                            data: import("zod").ZodOptional<
                                               import("zod").ZodRecord<
                                                  import("zod").ZodString,
                                                  import("zod").ZodAny
                                               >
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                         $Infer: {
                                            body: {
                                               email: string;
                                               password?: string | undefined;
                                               name: string;
                                               role?:
                                                  | "admin"
                                                  | "user"
                                                  | ("admin" | "user")[]
                                                  | undefined;
                                               data?:
                                                  | Record<string, any>
                                                  | undefined;
                                            };
                                         };
                                      };
                                   },
                                   {
                                      user: import("better-auth/plugins").UserWithRole;
                                   }
                                >;
                                adminUpdateUser: import("better-call").StrictEndpoint<
                                   "/admin/update-user",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                            data: import("zod").ZodRecord<
                                               import("zod").ZodAny,
                                               import("zod").ZodAny
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   import("better-auth/plugins").UserWithRole
                                >;
                                listUsers: import("better-call").StrictEndpoint<
                                   "/admin/list-users",
                                   {
                                      method: "GET";
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      query: import("zod").ZodObject<
                                         {
                                            searchValue: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            searchField: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  name: "name";
                                                  email: "email";
                                               }>
                                            >;
                                            searchOperator: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  contains: "contains";
                                                  starts_with: "starts_with";
                                                  ends_with: "ends_with";
                                               }>
                                            >;
                                            limit: import("zod").ZodOptional<
                                               import("zod").ZodUnion<
                                                  [
                                                     import("zod").ZodString,
                                                     import("zod").ZodNumber,
                                                  ]
                                               >
                                            >;
                                            offset: import("zod").ZodOptional<
                                               import("zod").ZodUnion<
                                                  [
                                                     import("zod").ZodString,
                                                     import("zod").ZodNumber,
                                                  ]
                                               >
                                            >;
                                            sortBy: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            sortDirection: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  asc: "asc";
                                                  desc: "desc";
                                               }>
                                            >;
                                            filterField: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            filterValue: import("zod").ZodOptional<
                                               import("zod").ZodUnion<
                                                  [
                                                     import("zod").ZodUnion<
                                                        [
                                                           import("zod").ZodUnion<
                                                              [
                                                                 import("zod").ZodUnion<
                                                                    [
                                                                       import("zod").ZodString,
                                                                       import("zod").ZodNumber,
                                                                    ]
                                                                 >,
                                                                 import("zod").ZodBoolean,
                                                              ]
                                                           >,
                                                           import("zod").ZodArray<
                                                              import("zod").ZodString
                                                           >,
                                                        ]
                                                     >,
                                                     import("zod").ZodArray<
                                                        import("zod").ZodNumber
                                                     >,
                                                  ]
                                               >
                                            >;
                                            filterOperator: import("zod").ZodOptional<
                                               import("zod").ZodEnum<{
                                                  eq: "eq";
                                                  ne: "ne";
                                                  gt: "gt";
                                                  gte: "gte";
                                                  lt: "lt";
                                                  lte: "lte";
                                                  in: "in";
                                                  not_in: "not_in";
                                                  contains: "contains";
                                                  starts_with: "starts_with";
                                                  ends_with: "ends_with";
                                               }>
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              users: {
                                                                 type: string;
                                                                 items: {
                                                                    $ref: string;
                                                                 };
                                                              };
                                                              total: {
                                                                 type: string;
                                                              };
                                                              limit: {
                                                                 type: string;
                                                              };
                                                              offset: {
                                                                 type: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      users: import("better-auth/plugins").UserWithRole[];
                                      total: number;
                                   }
                                >;
                                listUserSessions: import("better-call").StrictEndpoint<
                                   "/admin/list-user-sessions",
                                   {
                                      method: "POST";
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              sessions: {
                                                                 type: string;
                                                                 items: {
                                                                    $ref: string;
                                                                 };
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      sessions: import("better-auth/plugins").SessionWithImpersonatedBy[];
                                   }
                                >;
                                unbanUser: import("better-call").StrictEndpoint<
                                   "/admin/unban-user",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      user: import("better-auth/plugins").UserWithRole;
                                   }
                                >;
                                banUser: import("better-call").StrictEndpoint<
                                   "/admin/ban-user",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                            banReason: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            banExpiresIn: import("zod").ZodOptional<
                                               import("zod").ZodNumber
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      user: import("better-auth/plugins").UserWithRole;
                                   }
                                >;
                                impersonateUser: import("better-call").StrictEndpoint<
                                   "/admin/impersonate-user",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              session: {
                                                                 $ref: string;
                                                              };
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      session: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         userId: string;
                                         expiresAt: Date;
                                         token: string;
                                         ipAddress?: string | null | undefined;
                                         userAgent?: string | null | undefined;
                                      };
                                      user: import("better-auth/plugins").UserWithRole;
                                   }
                                >;
                                stopImpersonating: import("better-call").StrictEndpoint<
                                   "/admin/stop-impersonating",
                                   {
                                      method: "POST";
                                      requireHeaders: true;
                                   },
                                   {
                                      session: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         userId: string;
                                         expiresAt: Date;
                                         token: string;
                                         ipAddress?: string | null | undefined;
                                         userAgent?: string | null | undefined;
                                      } & Record<string, any>;
                                      user: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         email: string;
                                         emailVerified: boolean;
                                         name: string;
                                         image?: string | null | undefined;
                                      } & Record<string, any>;
                                   }
                                >;
                                revokeUserSession: import("better-call").StrictEndpoint<
                                   "/admin/revoke-user-session",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            sessionToken: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                revokeUserSessions: import("better-call").StrictEndpoint<
                                   "/admin/revoke-user-sessions",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                removeUser: import("better-call").StrictEndpoint<
                                   "/admin/remove-user",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                setUserPassword: import("better-call").StrictEndpoint<
                                   "/admin/set-user-password",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            newPassword: import("zod").ZodString;
                                            userId: import("zod").ZodCoercedString<unknown>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            user: import("better-auth/plugins").UserWithRole;
                                            session: {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            summary: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      status: boolean;
                                   }
                                >;
                                userHasPermission: import("better-call").StrictEndpoint<
                                   "/admin/has-permission",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodIntersection<
                                         import("zod").ZodObject<
                                            {
                                               userId: import("zod").ZodOptional<
                                                  import("zod").ZodCoercedString<unknown>
                                               >;
                                               role: import("zod").ZodOptional<
                                                  import("zod").ZodString
                                               >;
                                            },
                                            import("better-auth").$strip
                                         >,
                                         import("zod").ZodUnion<
                                            readonly [
                                               import("zod").ZodObject<
                                                  {
                                                     permission: import("zod").ZodRecord<
                                                        import("zod").ZodString,
                                                        import("zod").ZodArray<
                                                           import("zod").ZodString
                                                        >
                                                     >;
                                                     permissions: import("zod").ZodUndefined;
                                                  },
                                                  import("better-auth").$strip
                                               >,
                                               import("zod").ZodObject<
                                                  {
                                                     permission: import("zod").ZodUndefined;
                                                     permissions: import("zod").ZodRecord<
                                                        import("zod").ZodString,
                                                        import("zod").ZodArray<
                                                           import("zod").ZodString
                                                        >
                                                     >;
                                                  },
                                                  import("better-auth").$strip
                                               >,
                                            ]
                                         >
                                      >;
                                      metadata: {
                                         openapi: {
                                            description: string;
                                            requestBody: {
                                               content: {
                                                  "application/json": {
                                                     schema: {
                                                        type: "object";
                                                        properties: {
                                                           permissions: {
                                                              type: string;
                                                              description: string;
                                                           };
                                                        };
                                                        required: string[];
                                                     };
                                                  };
                                               };
                                            };
                                            responses: {
                                               "200": {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              error: {
                                                                 type: string;
                                                              };
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                         $Infer: {
                                            body: {
                                               permissions: {
                                                  readonly user?:
                                                     | (
                                                          | "ban"
                                                          | "create"
                                                          | "delete"
                                                          | "get"
                                                          | "impersonate"
                                                          | "impersonate-admins"
                                                          | "list"
                                                          | "set-password"
                                                          | "set-role"
                                                          | "update"
                                                       )[]
                                                     | undefined;
                                                  readonly session?:
                                                     | (
                                                          | "delete"
                                                          | "list"
                                                          | "revoke"
                                                       )[]
                                                     | undefined;
                                               };
                                            } & {
                                               userId?: string | undefined;
                                               role?:
                                                  | "admin"
                                                  | "user"
                                                  | undefined;
                                            };
                                         };
                                      };
                                   },
                                   {
                                      error: null;
                                      success: boolean;
                                   }
                                >;
                             };
                             $ERROR_CODES: {
                                USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
                                FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
                                USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
                                YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
                                YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
                                YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
                                YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
                                YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
                                YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
                                YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
                                YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
                                YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
                                YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
                                BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
                                YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
                                NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
                                YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
                                YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
                                YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
                                YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
                                INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
                             };
                             schema: {
                                user: {
                                   fields: {
                                      role: {
                                         type: "string";
                                         required: false;
                                         input: false;
                                      };
                                      banned: {
                                         type: "boolean";
                                         defaultValue: false;
                                         required: false;
                                         input: false;
                                      };
                                      banReason: {
                                         type: "string";
                                         required: false;
                                         input: false;
                                      };
                                      banExpires: {
                                         type: "date";
                                         required: false;
                                         input: false;
                                      };
                                   };
                                };
                                session: {
                                   fields: {
                                      impersonatedBy: {
                                         type: "string";
                                         required: false;
                                      };
                                   };
                                };
                             };
                             options: NoInfer<{
                                ac: import("better-auth/plugins").AccessControl<{
                                   readonly user: readonly [
                                      "create",
                                      "list",
                                      "set-role",
                                      "ban",
                                      "impersonate",
                                      "impersonate-admins",
                                      "delete",
                                      "set-password",
                                      "get",
                                      "update",
                                   ];
                                   readonly session: readonly [
                                      "list",
                                      "revoke",
                                      "delete",
                                   ];
                                }>;
                                roles: {
                                   admin: import("better-auth/plugins").Role;
                                   user: import("better-auth/plugins").Role;
                                };
                             }>;
                          };
                          getActions: () => {
                             admin: {
                                checkRolePermission: <
                                   R extends "admin" | "user",
                                >(
                                   data: {
                                      permissions: {
                                         readonly user?:
                                            | (
                                                 | "ban"
                                                 | "create"
                                                 | "delete"
                                                 | "get"
                                                 | "impersonate"
                                                 | "impersonate-admins"
                                                 | "list"
                                                 | "set-password"
                                                 | "set-role"
                                                 | "update"
                                              )[]
                                            | undefined;
                                         readonly session?:
                                            | ("delete" | "list" | "revoke")[]
                                            | undefined;
                                      };
                                   } & {
                                      role: R;
                                   },
                                ) => boolean;
                             };
                          };
                          pathMethods: {
                             "/admin/list-users": "GET";
                             "/admin/stop-impersonating": "POST";
                          };
                          $ERROR_CODES: {
                             USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
                             FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
                             USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
                             YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
                             YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
                             YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
                             YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
                             YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
                             YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
                             YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
                             YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
                             YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
                             BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
                             YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
                             NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
                             YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
                             YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
                             YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
                             YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
                             INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
                          };
                       }
                     | {
                          id: "email-otp";
                          $InferServerPlugin: {
                             id: "email-otp";
                             init(ctx: import("better-auth").AuthContext):
                                | {
                                     options: {
                                        emailVerification: {
                                           sendVerificationEmail(
                                              data: {
                                                 user: {
                                                    id: string;
                                                    createdAt: Date;
                                                    updatedAt: Date;
                                                    email: string;
                                                    emailVerified: boolean;
                                                    name: string;
                                                    image?:
                                                       | string
                                                       | null
                                                       | undefined;
                                                 };
                                                 url: string;
                                                 token: string;
                                              },
                                              request: Request | undefined,
                                           ): Promise<void>;
                                        };
                                     };
                                  }
                                | undefined;
                             endpoints: {
                                sendVerificationOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/send-verification-otp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            type: import("zod").ZodEnum<{
                                               "sign-in": "sign-in";
                                               "change-email": "change-email";
                                               "email-verification": "email-verification";
                                               "forget-password": "forget-password";
                                            }>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                createVerificationOTP: import("better-call").StrictEndpoint<
                                   string,
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            type: import("zod").ZodEnum<{
                                               "sign-in": "sign-in";
                                               "change-email": "change-email";
                                               "email-verification": "email-verification";
                                               "forget-password": "forget-password";
                                            }>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "string";
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   string
                                >;
                                getVerificationOTP: import("better-call").StrictEndpoint<
                                   string,
                                   {
                                      method: "GET";
                                      query: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            type: import("zod").ZodEnum<{
                                               "sign-in": "sign-in";
                                               "change-email": "change-email";
                                               "email-verification": "email-verification";
                                               "forget-password": "forget-password";
                                            }>;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               "200": {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              otp: {
                                                                 type: string;
                                                                 nullable: boolean;
                                                                 description: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   | {
                                        otp: null;
                                     }
                                   | {
                                        otp: string;
                                     }
                                >;
                                checkVerificationOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/check-verification-otp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            type: import("zod").ZodEnum<{
                                               "sign-in": "sign-in";
                                               "change-email": "change-email";
                                               "email-verification": "email-verification";
                                               "forget-password": "forget-password";
                                            }>;
                                            otp: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                verifyEmailOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/verify-email",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            otp: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                                 description: string;
                                                                 enum: boolean[];
                                                              };
                                                              token: {
                                                                 type: string;
                                                                 nullable: boolean;
                                                                 description: string;
                                                              };
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   | {
                                        status: boolean;
                                        token: string;
                                        user: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        } & Record<string, any>;
                                     }
                                   | {
                                        status: boolean;
                                        token: null;
                                        user: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        } & Record<string, any>;
                                     }
                                >;
                                signInEmailOTP: import("better-call").StrictEndpoint<
                                   "/sign-in/email-otp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodIntersection<
                                         import("zod").ZodObject<
                                            {
                                               email: import("zod").ZodString;
                                               otp: import("zod").ZodString;
                                               name: import("zod").ZodOptional<
                                                  import("zod").ZodString
                                               >;
                                               image: import("zod").ZodOptional<
                                                  import("zod").ZodString
                                               >;
                                            },
                                            import("better-auth").$strip
                                         >,
                                         import("zod").ZodRecord<
                                            import("zod").ZodString,
                                            import("zod").ZodAny
                                         >
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              token: {
                                                                 type: string;
                                                                 description: string;
                                                              };
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                           required: string[];
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      token: string;
                                      user: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         email: string;
                                         emailVerified: boolean;
                                         name: string;
                                         image?: string | null | undefined;
                                      };
                                   }
                                >;
                                requestPasswordResetEmailOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/request-password-reset",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                                 description: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                forgetPasswordEmailOTP: import("better-call").StrictEndpoint<
                                   "/forget-password/email-otp",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                                 description: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                resetPasswordEmailOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/reset-password",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodString;
                                            otp: import("zod").ZodString;
                                            password: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                requestEmailChangeEmailOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/request-email-change",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            newEmail: import("zod").ZodString;
                                            otp: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            session: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                            user: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               email: string;
                                               emailVerified: boolean;
                                               name: string;
                                               image?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                                changeEmailEmailOTP: import("better-call").StrictEndpoint<
                                   "/email-otp/change-email",
                                   {
                                      method: "POST";
                                      body: import("zod").ZodObject<
                                         {
                                            newEmail: import("zod").ZodString;
                                            otp: import("zod").ZodString;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<{
                                         session: {
                                            session: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               userId: string;
                                               expiresAt: Date;
                                               token: string;
                                               ipAddress?:
                                                  | string
                                                  | null
                                                  | undefined;
                                               userAgent?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                            user: Record<string, any> & {
                                               id: string;
                                               createdAt: Date;
                                               updatedAt: Date;
                                               email: string;
                                               emailVerified: boolean;
                                               name: string;
                                               image?:
                                                  | string
                                                  | null
                                                  | undefined;
                                            };
                                         };
                                      }>)[];
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              success: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      success: boolean;
                                   }
                                >;
                             };
                             hooks: {
                                after: {
                                   matcher(
                                      context: import("better-auth").HookEndpointContext,
                                   ): boolean;
                                   handler: (
                                      inputContext: import("better-call").MiddlewareInputContext<
                                         import("better-call").MiddlewareOptions
                                      >,
                                   ) => Promise<void>;
                                }[];
                             };
                             rateLimit: (
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/send-verification-otp";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/check-verification-otp";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/verify-email";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/sign-in/email-otp";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/request-password-reset";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/reset-password";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/forget-password/email-otp";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/request-email-change";
                                     window: number;
                                     max: number;
                                  }
                                | {
                                     pathMatcher(
                                        path: string,
                                     ): path is "/email-otp/change-email";
                                     window: number;
                                     max: number;
                                  }
                             )[];
                             options: import("better-auth/plugins").EmailOTPOptions;
                             $ERROR_CODES: {
                                OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
                                INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
                                TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
                             };
                          };
                          atomListeners: {
                             matcher: (
                                path: string,
                             ) => path is
                                | "/email-otp/verify-email"
                                | "/sign-in/email-otp";
                             signal: "$sessionSignal";
                          }[];
                          $ERROR_CODES: {
                             OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
                             INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
                             TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
                          };
                       }
                     | {
                          id: "last-login-method-client";
                          getActions(): {
                             getLastUsedLoginMethod: () => string | null;
                             clearLastUsedLoginMethod: () => void;
                             isLastUsedLoginMethod: (method: string) => boolean;
                          };
                       }
                     | {
                          id: "magic-link";
                          $InferServerPlugin: {
                             id: "magic-link";
                             endpoints: {
                                signInMagicLink: import("better-call").StrictEndpoint<
                                   "/sign-in/magic-link",
                                   {
                                      method: "POST";
                                      requireHeaders: true;
                                      body: import("zod").ZodObject<
                                         {
                                            email: import("zod").ZodEmail;
                                            name: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            callbackURL: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            newUserCallbackURL: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            errorCallbackURL: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              status: {
                                                                 type: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      status: boolean;
                                   }
                                >;
                                magicLinkVerify: import("better-call").StrictEndpoint<
                                   "/magic-link/verify",
                                   {
                                      method: "GET";
                                      query: import("zod").ZodObject<
                                         {
                                            token: import("zod").ZodString;
                                            callbackURL: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            errorCallbackURL: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                            newUserCallbackURL: import("zod").ZodOptional<
                                               import("zod").ZodString
                                            >;
                                         },
                                         import("better-auth").$strip
                                      >;
                                      use: ((
                                         inputContext: import("better-call").MiddlewareInputContext<
                                            import("better-call").MiddlewareOptions
                                         >,
                                      ) => Promise<void>)[];
                                      requireHeaders: true;
                                      metadata: {
                                         openapi: {
                                            operationId: string;
                                            description: string;
                                            responses: {
                                               200: {
                                                  description: string;
                                                  content: {
                                                     "application/json": {
                                                        schema: {
                                                           type: "object";
                                                           properties: {
                                                              session: {
                                                                 $ref: string;
                                                              };
                                                              user: {
                                                                 $ref: string;
                                                              };
                                                           };
                                                        };
                                                     };
                                                  };
                                               };
                                            };
                                         };
                                      };
                                   },
                                   {
                                      token: string;
                                      user: {
                                         id: string;
                                         createdAt: Date;
                                         updatedAt: Date;
                                         email: string;
                                         emailVerified: boolean;
                                         name: string;
                                         image?: string | null | undefined;
                                      };
                                   }
                                >;
                             };
                             rateLimit: {
                                pathMatcher(path: string): boolean;
                                window: number;
                                max: number;
                             }[];
                             options: import("better-auth/plugins").MagicLinkOptions;
                          };
                       }
                     | {
                          id: "organization";
                          $InferServerPlugin: import("better-auth/plugins").OrganizationPlugin<{
                             ac: import("better-auth/plugins").AccessControl<{
                                readonly organization: readonly [
                                   "update",
                                   "delete",
                                ];
                                readonly member: readonly [
                                   "create",
                                   "update",
                                   "delete",
                                ];
                                readonly invitation: readonly [
                                   "create",
                                   "cancel",
                                ];
                                readonly team: readonly [
                                   "create",
                                   "update",
                                   "delete",
                                ];
                                readonly ac: readonly [
                                   "create",
                                   "read",
                                   "update",
                                   "delete",
                                ];
                             }>;
                             roles: {
                                admin: import("better-auth/plugins").Role;
                                member: import("better-auth/plugins").Role;
                                owner: import("better-auth/plugins").Role;
                             };
                             teams: {
                                enabled: true;
                             };
                             schema: unknown;
                             dynamicAccessControl: {
                                enabled: false;
                             };
                          }>;
                          getActions: (
                             $fetch: import("@better-fetch/fetch").BetterFetch,
                             _$store: import("better-auth").ClientStore,
                             co:
                                | import("better-auth").BetterAuthClientOptions
                                | undefined,
                          ) => {
                             $Infer: {
                                ActiveOrganization: {
                                   members: {
                                      id: string;
                                      organizationId: string;
                                      role: "admin" | "member" | "owner";
                                      createdAt: Date;
                                      userId: string;
                                      teamId?: string | undefined;
                                      user: {
                                         id: string;
                                         email: string;
                                         name: string;
                                         image?: string | undefined;
                                      };
                                   }[];
                                   invitations: {
                                      id: string;
                                      organizationId: string;
                                      email: string;
                                      role: "admin" | "member" | "owner";
                                      status: import("better-auth/plugins").InvitationStatus;
                                      inviterId: string;
                                      expiresAt: Date;
                                      createdAt: Date;
                                      teamId?: string | undefined;
                                   }[];
                                   teams: {
                                      id: string;
                                      name: string;
                                      organizationId: string;
                                      createdAt: Date;
                                      updatedAt?: Date | undefined;
                                   }[];
                                } & {
                                   id: string;
                                   name: string;
                                   slug: string;
                                   createdAt: Date;
                                   logo?: string | null | undefined;
                                   metadata?: any;
                                };
                                Organization: {
                                   id: string;
                                   name: string;
                                   slug: string;
                                   logo?: string | null | undefined;
                                   metadata?: any;
                                   createdAt: Date;
                                };
                                Invitation: {
                                   id: string;
                                   organizationId: string;
                                   email: string;
                                   role: "admin" | "member" | "owner";
                                   status: import("better-auth/plugins").InvitationStatus;
                                   inviterId: string;
                                   expiresAt: Date;
                                   createdAt: Date;
                                   teamId?: string | undefined;
                                };
                                Member: {
                                   id: string;
                                   organizationId: string;
                                   role: "admin" | "member" | "owner";
                                   createdAt: Date;
                                   userId: string;
                                   teamId?: string | undefined;
                                   user: {
                                      id: string;
                                      email: string;
                                      name: string;
                                      image?: string | undefined;
                                   };
                                };
                                Team: {
                                   id: string;
                                   name: string;
                                   organizationId: string;
                                   createdAt: Date;
                                   updatedAt?: Date | undefined;
                                };
                             };
                             organization: {
                                checkRolePermission: <
                                   R extends "admin" | "member" | "owner",
                                >(
                                   data: {
                                      permissions: {
                                         readonly organization?:
                                            | ("delete" | "update")[]
                                            | undefined;
                                         readonly member?:
                                            | ("create" | "delete" | "update")[]
                                            | undefined;
                                         readonly invitation?:
                                            | ("cancel" | "create")[]
                                            | undefined;
                                         readonly team?:
                                            | ("create" | "delete" | "update")[]
                                            | undefined;
                                         readonly ac?:
                                            | (
                                                 | "create"
                                                 | "delete"
                                                 | "read"
                                                 | "update"
                                              )[]
                                            | undefined;
                                      };
                                   } & {
                                      role: R;
                                   },
                                ) => boolean;
                             };
                          };
                          getAtoms: (
                             $fetch: import("@better-fetch/fetch").BetterFetch,
                          ) => {
                             $listOrg: import("nanostores").PreinitializedWritableAtom<boolean> &
                                object;
                             $activeOrgSignal: import("nanostores").PreinitializedWritableAtom<boolean> &
                                object;
                             $activeMemberSignal: import("nanostores").PreinitializedWritableAtom<boolean> &
                                object;
                             $activeMemberRoleSignal: import("nanostores").PreinitializedWritableAtom<boolean> &
                                object;
                             activeOrganization: import("better-auth/client").AuthQueryAtom<
                                import("better-auth").Prettify<
                                   {
                                      id: string;
                                      name: string;
                                      slug: string;
                                      createdAt: Date;
                                      logo?: string | null | undefined;
                                      metadata?: any;
                                   } & {
                                      members: {
                                         id: string;
                                         organizationId: string;
                                         role: "admin" | "member" | "owner";
                                         createdAt: Date;
                                         userId: string;
                                         teamId?: string | undefined;
                                         user: {
                                            id: string;
                                            email: string;
                                            name: string;
                                            image?: string | undefined;
                                         };
                                      }[];
                                      invitations: {
                                         id: string;
                                         organizationId: string;
                                         email: string;
                                         role: "admin" | "member" | "owner";
                                         status: import("better-auth/plugins").InvitationStatus;
                                         inviterId: string;
                                         expiresAt: Date;
                                         createdAt: Date;
                                         teamId?: string | undefined;
                                      }[];
                                   }
                                >
                             >;
                             listOrganizations: import("better-auth/client").AuthQueryAtom<
                                {
                                   id: string;
                                   name: string;
                                   slug: string;
                                   createdAt: Date;
                                   logo?: string | null | undefined;
                                   metadata?: any;
                                }[]
                             >;
                             activeMember: import("better-auth/client").AuthQueryAtom<{
                                id: string;
                                organizationId: string;
                                userId: string;
                                role: string;
                                createdAt: Date;
                             }>;
                             activeMemberRole: import("better-auth/client").AuthQueryAtom<{
                                role: string;
                             }>;
                          };
                          pathMethods: {
                             "/organization/get-full-organization": "GET";
                             "/organization/list-user-teams": "GET";
                          };
                          atomListeners: (
                             | {
                                  matcher(
                                     path: string,
                                  ): path is
                                     | "/organization/create"
                                     | "/organization/delete"
                                     | "/organization/update";
                                  signal: "$listOrg";
                               }
                             | {
                                  matcher(path: string): boolean;
                                  signal: "$activeOrgSignal";
                               }
                             | {
                                  matcher(path: string): boolean;
                                  signal: "$sessionSignal";
                               }
                             | {
                                  matcher(path: string): boolean;
                                  signal: "$activeMemberSignal";
                               }
                             | {
                                  matcher(path: string): boolean;
                                  signal: "$activeMemberRoleSignal";
                               }
                          )[];
                          $ERROR_CODES: {
                             YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION">;
                             YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS">;
                             ORGANIZATION_ALREADY_EXISTS: import("better-auth").RawError<"ORGANIZATION_ALREADY_EXISTS">;
                             ORGANIZATION_SLUG_ALREADY_TAKEN: import("better-auth").RawError<"ORGANIZATION_SLUG_ALREADY_TAKEN">;
                             ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
                             USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION">;
                             YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION">;
                             YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION">;
                             NO_ACTIVE_ORGANIZATION: import("better-auth").RawError<"NO_ACTIVE_ORGANIZATION">;
                             USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION">;
                             MEMBER_NOT_FOUND: import("better-auth").RawError<"MEMBER_NOT_FOUND">;
                             ROLE_NOT_FOUND: import("better-auth").RawError<"ROLE_NOT_FOUND">;
                             YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM">;
                             TEAM_ALREADY_EXISTS: import("better-auth").RawError<"TEAM_ALREADY_EXISTS">;
                             TEAM_NOT_FOUND: import("better-auth").RawError<"TEAM_NOT_FOUND">;
                             YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER">;
                             YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER">;
                             YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER">;
                             YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION">;
                             USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION">;
                             INVITATION_NOT_FOUND: import("better-auth").RawError<"INVITATION_NOT_FOUND">;
                             YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION">;
                             EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION">;
                             YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION">;
                             INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION">;
                             YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE">;
                             FAILED_TO_RETRIEVE_INVITATION: import("better-auth").RawError<"FAILED_TO_RETRIEVE_INVITATION">;
                             YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS">;
                             UNABLE_TO_REMOVE_LAST_TEAM: import("better-auth").RawError<"UNABLE_TO_REMOVE_LAST_TEAM">;
                             YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER">;
                             ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: import("better-auth").RawError<"ORGANIZATION_MEMBERSHIP_LIMIT_REACHED">;
                             YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION">;
                             YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION">;
                             YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM">;
                             YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM">;
                             INVITATION_LIMIT_REACHED: import("better-auth").RawError<"INVITATION_LIMIT_REACHED">;
                             TEAM_MEMBER_LIMIT_REACHED: import("better-auth").RawError<"TEAM_MEMBER_LIMIT_REACHED">;
                             USER_IS_NOT_A_MEMBER_OF_THE_TEAM: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_TEAM">;
                             YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM: import("better-auth").RawError<"YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM">;
                             YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: import("better-auth").RawError<"YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM">;
                             YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER">;
                             YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER">;
                             YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION">;
                             YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION">;
                             MISSING_AC_INSTANCE: import("better-auth").RawError<"MISSING_AC_INSTANCE">;
                             YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE">;
                             YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE">;
                             TOO_MANY_ROLES: import("better-auth").RawError<"TOO_MANY_ROLES">;
                             INVALID_RESOURCE: import("better-auth").RawError<"INVALID_RESOURCE">;
                             ROLE_NAME_IS_ALREADY_TAKEN: import("better-auth").RawError<"ROLE_NAME_IS_ALREADY_TAKEN">;
                             CANNOT_DELETE_A_PRE_DEFINED_ROLE: import("better-auth").RawError<"CANNOT_DELETE_A_PRE_DEFINED_ROLE">;
                             ROLE_IS_ASSIGNED_TO_MEMBERS: import("better-auth").RawError<"ROLE_IS_ASSIGNED_TO_MEMBERS">;
                          };
                       }
                  )[];
               },
               FetchOptions
            >
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            | (Omit<
                 {
                    token: null;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              })
            | (Omit<
                 {
                    token: string;
                    user: {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              }),
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   subscription: {
      billingPortal: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               locale?:
                  | import("stripe").Stripe.Checkout.Session.Locale
                  | undefined;
               referenceId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
               returnUrl?: string | undefined;
               disableRedirect?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<
                 {
                    locale?:
                       | import("stripe").Stripe.Checkout.Session.Locale
                       | undefined;
                    referenceId?: string | undefined;
                    customerType?: "organization" | "user" | undefined;
                    returnUrl?: string | undefined;
                    disableRedirect?: boolean | undefined;
                 } & {
                    fetchOptions?: FetchOptions | undefined;
                 }
              >
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               url: string;
               redirect: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   subscription: {
      cancel: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               referenceId?: string | undefined;
               subscriptionId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
               returnUrl: string;
               disableRedirect?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               referenceId?: string | undefined;
               subscriptionId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
               returnUrl: string;
               disableRedirect?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               url: string;
               redirect: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   subscription: {
      list: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<{
               referenceId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
            }> &
               Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?:
                    | {
                         referenceId?: string | undefined;
                         customerType?: "organization" | "user" | undefined;
                      }
                    | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               limits: Record<string, unknown> | undefined;
               priceId: string | undefined;
               id: string;
               plan: string;
               stripeCustomerId?: string | undefined;
               stripeSubscriptionId?: string | undefined;
               trialStart?: Date | undefined;
               trialEnd?: Date | undefined;
               referenceId: string;
               status:
                  | "active"
                  | "canceled"
                  | "incomplete"
                  | "incomplete_expired"
                  | "past_due"
                  | "paused"
                  | "trialing"
                  | "unpaid";
               periodStart?: Date | undefined;
               periodEnd?: Date | undefined;
               cancelAtPeriodEnd?: boolean | undefined;
               cancelAt?: Date | undefined;
               canceledAt?: Date | undefined;
               endedAt?: Date | undefined;
               groupId?: string | undefined;
               seats?: number | undefined;
               billingInterval?: "day" | "month" | "week" | "year" | undefined;
               stripeScheduleId?: string | undefined;
            }[],
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   subscription: {
      restore: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               referenceId?: string | undefined;
               subscriptionId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<
                 {
                    referenceId?: string | undefined;
                    subscriptionId?: string | undefined;
                    customerType?: "organization" | "user" | undefined;
                 } & {
                    fetchOptions?: FetchOptions | undefined;
                 }
              >
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               import("stripe").Stripe.Subscription & {
                  lastResponse: {
                     headers: {
                        [key: string]: string;
                     };
                     requestId: string;
                     statusCode: number;
                     apiVersion?: string | undefined;
                     idempotencyKey?: string | undefined;
                     stripeAccount?: string | undefined;
                  };
               }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   subscription: {
      success: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            never,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?: Record<string, any> | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            never,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   subscription: {
      upgrade: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               plan: string;
               annual?: boolean | undefined;
               referenceId?: string | undefined;
               subscriptionId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
               metadata?: Record<string, any> | undefined;
               seats?: number | undefined;
               locale?:
                  | import("stripe").Stripe.Checkout.Session.Locale
                  | undefined;
               successUrl?: string | undefined;
               cancelUrl?: string | undefined;
               returnUrl?: string | undefined;
               scheduleAtPeriodEnd?: boolean | undefined;
               disableRedirect?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               plan: string;
               annual?: boolean | undefined;
               referenceId?: string | undefined;
               subscriptionId?: string | undefined;
               customerType?: "organization" | "user" | undefined;
               metadata?: Record<string, any> | undefined;
               seats?: number | undefined;
               locale?:
                  | import("stripe").Stripe.Checkout.Session.Locale
                  | undefined;
               successUrl?: string | undefined;
               cancelUrl?: string | undefined;
               returnUrl?: string | undefined;
               scheduleAtPeriodEnd?: boolean | undefined;
               disableRedirect?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            NonNullable<
               | {
                    url: string;
                    redirect: boolean;
                 }
               | {
                    redirect: boolean;
                    id: string;
                    object: "checkout.session";
                    adaptive_pricing:
                       | import("stripe").Stripe.Checkout.Session.AdaptivePricing
                       | null;
                    after_expiration:
                       | import("stripe").Stripe.Checkout.Session.AfterExpiration
                       | null;
                    allow_promotion_codes: boolean | null;
                    amount_subtotal: number | null;
                    amount_total: number | null;
                    automatic_tax: import("stripe").Stripe.Checkout.Session.AutomaticTax;
                    billing_address_collection:
                       | import("stripe").Stripe.Checkout.Session.BillingAddressCollection
                       | null;
                    branding_settings?:
                       | import("stripe").Stripe.Checkout.Session.BrandingSettings
                       | undefined;
                    cancel_url: string | null;
                    client_reference_id: string | null;
                    client_secret: string | null;
                    collected_information:
                       | import("stripe").Stripe.Checkout.Session.CollectedInformation
                       | null;
                    consent:
                       | import("stripe").Stripe.Checkout.Session.Consent
                       | null;
                    consent_collection:
                       | import("stripe").Stripe.Checkout.Session.ConsentCollection
                       | null;
                    created: number;
                    currency: string | null;
                    currency_conversion:
                       | import("stripe").Stripe.Checkout.Session.CurrencyConversion
                       | null;
                    custom_fields: import("stripe").Stripe.Checkout.Session.CustomField[];
                    custom_text: import("stripe").Stripe.Checkout.Session.CustomText;
                    customer:
                       | string
                       | import("stripe").Stripe.Customer
                       | import("stripe").Stripe.DeletedCustomer
                       | null;
                    customer_account: string | null;
                    customer_creation:
                       | import("stripe").Stripe.Checkout.Session.CustomerCreation
                       | null;
                    customer_details:
                       | import("stripe").Stripe.Checkout.Session.CustomerDetails
                       | null;
                    customer_email: string | null;
                    discounts:
                       | import("stripe").Stripe.Checkout.Session.Discount[]
                       | null;
                    excluded_payment_method_types?: string[] | undefined;
                    expires_at: number;
                    invoice: string | import("stripe").Stripe.Invoice | null;
                    invoice_creation:
                       | import("stripe").Stripe.Checkout.Session.InvoiceCreation
                       | null;
                    line_items?:
                       | import("stripe").Stripe.ApiList<
                            import("stripe").Stripe.LineItem
                         >
                       | undefined;
                    livemode: boolean;
                    locale:
                       | import("stripe").Stripe.Checkout.Session.Locale
                       | null;
                    metadata: import("stripe").Stripe.Metadata | null;
                    mode: import("stripe").Stripe.Checkout.Session.Mode;
                    name_collection?:
                       | import("stripe").Stripe.Checkout.Session.NameCollection
                       | undefined;
                    optional_items?:
                       | import("stripe").Stripe.Checkout.Session.OptionalItem[]
                       | null
                       | undefined;
                    origin_context:
                       | import("stripe").Stripe.Checkout.Session.OriginContext
                       | null;
                    payment_intent:
                       | string
                       | import("stripe").Stripe.PaymentIntent
                       | null;
                    payment_link:
                       | string
                       | import("stripe").Stripe.PaymentLink
                       | null;
                    payment_method_collection:
                       | import("stripe").Stripe.Checkout.Session.PaymentMethodCollection
                       | null;
                    payment_method_configuration_details:
                       | import("stripe").Stripe.Checkout.Session.PaymentMethodConfigurationDetails
                       | null;
                    payment_method_options:
                       | import("stripe").Stripe.Checkout.Session.PaymentMethodOptions
                       | null;
                    payment_method_types: string[];
                    payment_status: import("stripe").Stripe.Checkout.Session.PaymentStatus;
                    permissions:
                       | import("stripe").Stripe.Checkout.Session.Permissions
                       | null;
                    phone_number_collection?:
                       | import("stripe").Stripe.Checkout.Session.PhoneNumberCollection
                       | undefined;
                    presentment_details?:
                       | import("stripe").Stripe.Checkout.Session.PresentmentDetails
                       | undefined;
                    recovered_from: string | null;
                    redirect_on_completion?:
                       | import("stripe").Stripe.Checkout.Session.RedirectOnCompletion
                       | undefined;
                    return_url?: string | undefined;
                    saved_payment_method_options:
                       | import("stripe").Stripe.Checkout.Session.SavedPaymentMethodOptions
                       | null;
                    setup_intent:
                       | string
                       | import("stripe").Stripe.SetupIntent
                       | null;
                    shipping_address_collection:
                       | import("stripe").Stripe.Checkout.Session.ShippingAddressCollection
                       | null;
                    shipping_cost:
                       | import("stripe").Stripe.Checkout.Session.ShippingCost
                       | null;
                    shipping_options: import("stripe").Stripe.Checkout.Session.ShippingOption[];
                    status:
                       | import("stripe").Stripe.Checkout.Session.Status
                       | null;
                    submit_type:
                       | import("stripe").Stripe.Checkout.Session.SubmitType
                       | null;
                    subscription:
                       | string
                       | import("stripe").Stripe.Subscription
                       | null;
                    success_url: string | null;
                    tax_id_collection?:
                       | import("stripe").Stripe.Checkout.Session.TaxIdCollection
                       | undefined;
                    total_details:
                       | import("stripe").Stripe.Checkout.Session.TotalDetails
                       | null;
                    ui_mode:
                       | import("stripe").Stripe.Checkout.Session.UiMode
                       | null;
                    url: string | null;
                    wallet_options:
                       | import("stripe").Stripe.Checkout.Session.WalletOptions
                       | null;
                    lastResponse: {
                       headers: {
                          [key: string]: string;
                       };
                       requestId: string;
                       statusCode: number;
                       apiVersion?: string | undefined;
                       idempotencyKey?: string | undefined;
                       stripeAccount?: string | undefined;
                    };
                 }
            >,
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      disable: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               password: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               password: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               status: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      enable: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               password: string;
               issuer?: string | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               password: string;
               issuer?: string | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               totpURI: string;
               backupCodes: string[];
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      generateBackupCodes: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               password: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               password: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               status: boolean;
               backupCodes: string[];
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      getTotpUri: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               password: string;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               password: string;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               totpURI: string;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      sendOtp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               trustDevice?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0?:
            | import("better-auth").Prettify<{
                 query?: Record<string, any> | undefined;
                 fetchOptions?: FetchOptions | undefined;
              }>
            | undefined,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            {
               status: boolean;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      verifyBackupCode: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               code: string;
               disableSession?: boolean | undefined;
               trustDevice?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               code: string;
               disableSession?: boolean | undefined;
               trustDevice?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            Omit<
               {
                  token: string | undefined;
                  user:
                     | import("better-auth/plugins").UserWithTwoFactor
                     | (Record<string, any> & {
                          id: string;
                          createdAt: Date;
                          updatedAt: Date;
                          email: string;
                          emailVerified: boolean;
                          name: string;
                          image?: string | null | undefined;
                       });
               },
               "user"
            > & {
               user: import("better-auth").StripEmptyObjects<
                  {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  } & {
                     twoFactorEnabled: boolean | null | undefined;
                  } & {} & {} & {
                     stripeCustomerId?: string | null | undefined;
                  } & {
                     telemetryConsent: boolean;
                  } & {} & {
                     banned: boolean | null | undefined;
                  } & {
                     banExpires?: Date | null | undefined;
                     banReason?: string | null | undefined;
                     role?: string | null | undefined;
                  }
               >;
            },
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      verifyOtp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               code: string;
               trustDevice?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               code: string;
               trustDevice?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            | (Omit<
                 {
                    token: string;
                    user: import("better-auth/plugins").UserWithTwoFactor;
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              })
            | (Omit<
                 {
                    token: string;
                    user: Record<string, any> & {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              }),
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   twoFactor: {
      verifyTotp: <
         FetchOptions extends import("better-auth").ClientFetchOption<
            Partial<{
               code: string;
               trustDevice?: boolean | undefined;
            }> &
               Record<string, any>,
            Partial<Record<string, any>> & Record<string, any>,
            Record<string, any> | undefined
         >,
      >(
         data_0: import("better-auth").Prettify<
            {
               code: string;
               trustDevice?: boolean | undefined;
            } & {
               fetchOptions?: FetchOptions | undefined;
            }
         >,
         data_1?: FetchOptions | undefined,
      ) => Promise<
         import("@better-fetch/fetch").BetterFetchResponse<
            | (Omit<
                 {
                    token: string;
                    user: import("better-auth/plugins").UserWithTwoFactor;
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              })
            | (Omit<
                 {
                    token: string;
                    user: Record<string, any> & {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    };
                 },
                 "user"
              > & {
                 user: import("better-auth").StripEmptyObjects<
                    {
                       id: string;
                       createdAt: Date;
                       updatedAt: Date;
                       email: string;
                       emailVerified: boolean;
                       name: string;
                       image?: string | null | undefined;
                    } & {
                       twoFactorEnabled: boolean | null | undefined;
                    } & {} & {} & {
                       stripeCustomerId?: string | null | undefined;
                    } & {
                       telemetryConsent: boolean;
                    } & {} & {
                       banned: boolean | null | undefined;
                    } & {
                       banExpires?: Date | null | undefined;
                       banReason?: string | null | undefined;
                       role?: string | null | undefined;
                    }
                 >;
              }),
            {
               code?: string | undefined;
               message?: string | undefined;
            },
            FetchOptions["throw"] extends true ? true : false
         >
      >;
   };
} & {
   accountInfo: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<{
            accountId?: string | undefined;
         }> &
            Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?:
                 | {
                      accountId?: string | undefined;
                   }
                 | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            user: import("better-auth").OAuth2UserInfo;
            data: Record<string, any>;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   changeEmail: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            newEmail: string;
            callbackURL?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            newEmail: string;
            callbackURL?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   changePassword: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            newPassword: string;
            currentPassword: string;
            revokeOtherSessions?: boolean | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            newPassword: string;
            currentPassword: string;
            revokeOtherSessions?: boolean | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         Omit<
            {
               token: string | null;
               user: {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
               } & Record<string, any> & {
                     id: string;
                     createdAt: Date;
                     updatedAt: Date;
                     email: string;
                     emailVerified: boolean;
                     name: string;
                     image?: string | null | undefined;
                  };
            },
            "user"
         > & {
            user: import("better-auth").StripEmptyObjects<
               {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
               } & {
                  twoFactorEnabled: boolean | null | undefined;
               } & {} & {} & {
                  stripeCustomerId?: string | null | undefined;
               } & {
                  telemetryConsent: boolean;
               } & {} & {
                  banned: boolean | null | undefined;
               } & {
                  banExpires?: Date | null | undefined;
                  banReason?: string | null | undefined;
                  role?: string | null | undefined;
               }
            >;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   deleteUser: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            callbackURL?: string | undefined;
            password?: string | undefined;
            token?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<
              {
                 callbackURL?: string | undefined;
                 password?: string | undefined;
                 token?: string | undefined;
              } & {
                 fetchOptions?: FetchOptions | undefined;
              }
           >
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            success: boolean;
            message: string;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   getAccessToken: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            providerId: string;
            accountId?: string | undefined;
            userId?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            providerId: string;
            accountId?: string | undefined;
            userId?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            accessToken: string;
            accessTokenExpiresAt: Date | undefined;
            scopes: string[];
            idToken: string | undefined;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   linkSocial: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            callbackURL?: string | undefined;
            provider: unknown;
            idToken?:
               | {
                    token: string;
                    nonce?: string | undefined;
                    accessToken?: string | undefined;
                    refreshToken?: string | undefined;
                    scopes?: string[] | undefined;
                 }
               | undefined;
            requestSignUp?: boolean | undefined;
            scopes?: string[] | undefined;
            errorCallbackURL?: string | undefined;
            disableRedirect?: boolean | undefined;
            additionalData?: Record<string, any> | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            callbackURL?: string | undefined;
            provider: unknown;
            idToken?:
               | {
                    token: string;
                    nonce?: string | undefined;
                    accessToken?: string | undefined;
                    refreshToken?: string | undefined;
                    scopes?: string[] | undefined;
                 }
               | undefined;
            requestSignUp?: boolean | undefined;
            scopes?: string[] | undefined;
            errorCallbackURL?: string | undefined;
            disableRedirect?: boolean | undefined;
            additionalData?: Record<string, any> | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            url: string;
            redirect: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   listAccounts: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?: Record<string, any> | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            scopes: string[];
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            providerId: string;
            accountId: string;
         }[],
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   listSessions: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?: Record<string, any> | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         import("better-auth").Prettify<{
            id: string;
            createdAt: Date;
            updatedAt: Date;
            userId: string;
            expiresAt: Date;
            token: string;
            ipAddress?: string | null | undefined;
            userAgent?: string | null | undefined;
         }>[],
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   refreshToken: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            providerId: string;
            accountId?: string | undefined;
            userId?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            providerId: string;
            accountId?: string | undefined;
            userId?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            accessToken: string | undefined;
            refreshToken: string;
            accessTokenExpiresAt: Date | undefined;
            refreshTokenExpiresAt: Date | null | undefined;
            scope: string | null | undefined;
            idToken: string | null | undefined;
            providerId: string;
            accountId: string;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   requestPasswordReset: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            email: string;
            redirectTo?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            email: string;
            redirectTo?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
            message: string;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   resetPassword: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            newPassword: string;
            token?: string | undefined;
         }> &
            Record<string, any>,
         Partial<{
            token?: string | undefined;
         }> &
            Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            newPassword: string;
            token?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   revokeOtherSessions: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?: Record<string, any> | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   revokeSession: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            token: string;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            token: string;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   revokeSessions: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?: Record<string, any> | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   sendVerificationEmail: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            email: string;
            callbackURL?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            email: string;
            callbackURL?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   signOut: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?: Record<string, any> | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            success: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   unlinkAccount: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<{
            providerId: string;
            accountId?: string | undefined;
         }> &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<
         {
            providerId: string;
            accountId?: string | undefined;
         } & {
            fetchOptions?: FetchOptions | undefined;
         }
      >,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   updateSession: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<Partial<{}>> & Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<
              Partial<{}> & {
                 fetchOptions?: FetchOptions | undefined;
              }
           >
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            session: {
               id: string;
               createdAt: Date;
               updatedAt: Date;
               userId: string;
               expiresAt: Date;
               token: string;
               ipAddress?: string | null | undefined;
               userAgent?: string | null | undefined;
            };
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   updateUser: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         Partial<
            Partial<{}> & {
               name?: string | undefined;
               image?: string | null | undefined;
            }
         > &
            Record<string, any>,
         Partial<Record<string, any>> & Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<
              import("better-auth/client").InferUserUpdateCtx<
                 {
                    baseURL: string;
                    fetchOptions: {
                       onError: (
                          context: import("@better-fetch/fetch").ErrorContext,
                       ) => void;
                       onSuccess: () => void;
                    };
                    plugins: (
                       | {
                            id: "api-key";
                            $ERROR_CODES: {
                               INVALID_METADATA_TYPE: import("better-auth").RawError<"INVALID_METADATA_TYPE">;
                               REFILL_AMOUNT_AND_INTERVAL_REQUIRED: import("better-auth").RawError<"REFILL_AMOUNT_AND_INTERVAL_REQUIRED">;
                               REFILL_INTERVAL_AND_AMOUNT_REQUIRED: import("better-auth").RawError<"REFILL_INTERVAL_AND_AMOUNT_REQUIRED">;
                               USER_BANNED: import("better-auth").RawError<"USER_BANNED">;
                               UNAUTHORIZED_SESSION: import("better-auth").RawError<"UNAUTHORIZED_SESSION">;
                               KEY_NOT_FOUND: import("better-auth").RawError<"KEY_NOT_FOUND">;
                               KEY_DISABLED: import("better-auth").RawError<"KEY_DISABLED">;
                               KEY_EXPIRED: import("better-auth").RawError<"KEY_EXPIRED">;
                               USAGE_EXCEEDED: import("better-auth").RawError<"USAGE_EXCEEDED">;
                               KEY_NOT_RECOVERABLE: import("better-auth").RawError<"KEY_NOT_RECOVERABLE">;
                               EXPIRES_IN_IS_TOO_SMALL: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_SMALL">;
                               EXPIRES_IN_IS_TOO_LARGE: import("better-auth").RawError<"EXPIRES_IN_IS_TOO_LARGE">;
                               INVALID_REMAINING: import("better-auth").RawError<"INVALID_REMAINING">;
                               INVALID_PREFIX_LENGTH: import("better-auth").RawError<"INVALID_PREFIX_LENGTH">;
                               INVALID_NAME_LENGTH: import("better-auth").RawError<"INVALID_NAME_LENGTH">;
                               METADATA_DISABLED: import("better-auth").RawError<"METADATA_DISABLED">;
                               RATE_LIMIT_EXCEEDED: import("better-auth").RawError<"RATE_LIMIT_EXCEEDED">;
                               NO_VALUES_TO_UPDATE: import("better-auth").RawError<"NO_VALUES_TO_UPDATE">;
                               KEY_DISABLED_EXPIRATION: import("better-auth").RawError<"KEY_DISABLED_EXPIRATION">;
                               INVALID_API_KEY: import("better-auth").RawError<"INVALID_API_KEY">;
                               INVALID_USER_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_USER_ID_FROM_API_KEY">;
                               INVALID_REFERENCE_ID_FROM_API_KEY: import("better-auth").RawError<"INVALID_REFERENCE_ID_FROM_API_KEY">;
                               INVALID_API_KEY_GETTER_RETURN_TYPE: import("better-auth").RawError<"INVALID_API_KEY_GETTER_RETURN_TYPE">;
                               SERVER_ONLY_PROPERTY: import("better-auth").RawError<"SERVER_ONLY_PROPERTY">;
                               FAILED_TO_UPDATE_API_KEY: import("better-auth").RawError<"FAILED_TO_UPDATE_API_KEY">;
                               NAME_REQUIRED: import("better-auth").RawError<"NAME_REQUIRED">;
                               ORGANIZATION_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_ID_REQUIRED">;
                               USER_NOT_MEMBER_OF_ORGANIZATION: import("better-auth").RawError<"USER_NOT_MEMBER_OF_ORGANIZATION">;
                               INSUFFICIENT_API_KEY_PERMISSIONS: import("better-auth").RawError<"INSUFFICIENT_API_KEY_PERMISSIONS">;
                               NO_DEFAULT_API_KEY_CONFIGURATION_FOUND: import("better-auth").RawError<"NO_DEFAULT_API_KEY_CONFIGURATION_FOUND">;
                               ORGANIZATION_PLUGIN_REQUIRED: import("better-auth").RawError<"ORGANIZATION_PLUGIN_REQUIRED">;
                            };
                            hooks: {
                               before: {
                                  matcher: (
                                     ctx: import("better-auth").HookEndpointContext,
                                  ) => boolean;
                                  handler: (
                                     inputContext: import("better-call").MiddlewareInputContext<
                                        import("better-call").MiddlewareOptions
                                     >,
                                  ) => Promise<
                                     | {
                                          user: {
                                             id: string;
                                             createdAt: Date;
                                             updatedAt: Date;
                                             email: string;
                                             emailVerified: boolean;
                                             name: string;
                                             image?: string | null | undefined;
                                          };
                                          session: {
                                             id: string;
                                             token: string;
                                             userId: string;
                                             userAgent: string | null;
                                             ipAddress: string | null;
                                             createdAt: Date;
                                             updatedAt: Date;
                                             expiresAt: Date;
                                          };
                                       }
                                     | {
                                          context: import("better-call").MiddlewareContext<
                                             import("better-call").MiddlewareOptions,
                                             {
                                                returned?: unknown;
                                                responseHeaders?:
                                                   | Headers
                                                   | undefined;
                                             } & import("better-auth").PluginContext<
                                                import("better-auth").BetterAuthOptions
                                             > &
                                                import("better-auth").InfoContext & {
                                                   options: import("better-auth").BetterAuthOptions;
                                                   trustedOrigins: string[];
                                                   trustedProviders: string[];
                                                   isTrustedOrigin: (
                                                      url: string,
                                                      settings?:
                                                         | {
                                                              allowRelativePaths: boolean;
                                                           }
                                                         | undefined,
                                                   ) => boolean;
                                                   oauthConfig: {
                                                      skipStateCookieCheck?:
                                                         | boolean
                                                         | undefined;
                                                      storeStateStrategy:
                                                         | "cookie"
                                                         | "database";
                                                   };
                                                   newSession: {
                                                      session: {
                                                         id: string;
                                                         createdAt: Date;
                                                         updatedAt: Date;
                                                         userId: string;
                                                         expiresAt: Date;
                                                         token: string;
                                                         ipAddress?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                         userAgent?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                      } & Record<string, any>;
                                                      user: {
                                                         id: string;
                                                         createdAt: Date;
                                                         updatedAt: Date;
                                                         email: string;
                                                         emailVerified: boolean;
                                                         name: string;
                                                         image?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                      } & Record<string, any>;
                                                   } | null;
                                                   session: {
                                                      session: {
                                                         id: string;
                                                         createdAt: Date;
                                                         updatedAt: Date;
                                                         userId: string;
                                                         expiresAt: Date;
                                                         token: string;
                                                         ipAddress?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                         userAgent?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                      } & Record<string, any>;
                                                      user: {
                                                         id: string;
                                                         createdAt: Date;
                                                         updatedAt: Date;
                                                         email: string;
                                                         emailVerified: boolean;
                                                         name: string;
                                                         image?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                      } & Record<string, any>;
                                                   } | null;
                                                   setNewSession: (
                                                      session: {
                                                         session: {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            userId: string;
                                                            expiresAt: Date;
                                                            token: string;
                                                            ipAddress?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                            userAgent?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         } & Record<
                                                            string,
                                                            any
                                                         >;
                                                         user: {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            email: string;
                                                            emailVerified: boolean;
                                                            name: string;
                                                            image?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         } & Record<
                                                            string,
                                                            any
                                                         >;
                                                      } | null,
                                                   ) => void;
                                                   socialProviders: import("better-auth").OAuthProvider<
                                                      Record<string, any>,
                                                      Partial<
                                                         import("better-auth").ProviderOptions<any>
                                                      >
                                                   >[];
                                                   authCookies: import("better-auth").BetterAuthCookies;
                                                   logger: import("better-auth").InternalLogger;
                                                   rateLimit: {
                                                      enabled: boolean;
                                                      window: number;
                                                      max: number;
                                                      storage:
                                                         | "database"
                                                         | "memory"
                                                         | "secondary-storage";
                                                   } & Omit<
                                                      import("better-auth").BetterAuthRateLimitOptions,
                                                      | "enabled"
                                                      | "max"
                                                      | "storage"
                                                      | "window"
                                                   >;
                                                   adapter: import("better-auth").DBAdapter<
                                                      import("better-auth").BetterAuthOptions
                                                   >;
                                                   internalAdapter: import("better-auth").InternalAdapter<
                                                      import("better-auth").BetterAuthOptions
                                                   >;
                                                   createAuthCookie: (
                                                      cookieName: string,
                                                      overrideAttributes?:
                                                         | Partial<
                                                              import("better-call").CookieOptions
                                                           >
                                                         | undefined,
                                                   ) => import("better-auth").BetterAuthCookie;
                                                   secret: string;
                                                   secretConfig:
                                                      | string
                                                      | import("better-auth").SecretConfig;
                                                   sessionConfig: {
                                                      updateAge: number;
                                                      expiresIn: number;
                                                      freshAge: number;
                                                      cookieRefreshCache:
                                                         | false
                                                         | {
                                                              enabled: true;
                                                              updateAge: number;
                                                           };
                                                   };
                                                   generateId: (options: {
                                                      model: import("better-auth").ModelNames;
                                                      size?: number | undefined;
                                                   }) => string | false;
                                                   secondaryStorage:
                                                      | import("better-auth").SecondaryStorage
                                                      | undefined;
                                                   password: {
                                                      hash: (
                                                         password: string,
                                                      ) => Promise<string>;
                                                      verify: (data: {
                                                         password: string;
                                                         hash: string;
                                                      }) => Promise<boolean>;
                                                      config: {
                                                         minPasswordLength: number;
                                                         maxPasswordLength: number;
                                                      };
                                                      checkPassword: (
                                                         userId: string,
                                                         ctx: import("better-auth").GenericEndpointContext<
                                                            import("better-auth").BetterAuthOptions
                                                         >,
                                                      ) => Promise<boolean>;
                                                   };
                                                   tables: import("better-auth").BetterAuthDBSchema;
                                                   runMigrations: () => Promise<void>;
                                                   publishTelemetry: (event: {
                                                      type: string;
                                                      anonymousId?:
                                                         | string
                                                         | undefined;
                                                      payload: Record<
                                                         string,
                                                         any
                                                      >;
                                                   }) => Promise<void>;
                                                   skipOriginCheck:
                                                      | boolean
                                                      | string[];
                                                   skipCSRFCheck: boolean;
                                                   runInBackground: (
                                                      promise: Promise<unknown>,
                                                   ) => void;
                                                   runInBackgroundOrAwait: (
                                                      promise: void | Promise<unknown>,
                                                   ) => unknown;
                                                }
                                          >;
                                       }
                                  >;
                               }[];
                            };
                            endpoints: {
                               createApiKey: import("better-call").StrictEndpoint<
                                  "/api-key/create",
                                  {
                                     method: "POST";
                                     body: import("zod").ZodObject<
                                        {
                                           configId: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           name: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           expiresIn: import("zod").ZodDefault<
                                              import("zod").ZodNullable<
                                                 import("zod").ZodOptional<
                                                    import("zod").ZodNumber
                                                 >
                                              >
                                           >;
                                           prefix: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           remaining: import("zod").ZodDefault<
                                              import("zod").ZodNullable<
                                                 import("zod").ZodOptional<
                                                    import("zod").ZodNumber
                                                 >
                                              >
                                           >;
                                           metadata: import("zod").ZodOptional<
                                              import("zod").ZodAny
                                           >;
                                           refillAmount: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           refillInterval: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           rateLimitTimeWindow: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           rateLimitMax: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           rateLimitEnabled: import("zod").ZodOptional<
                                              import("zod").ZodBoolean
                                           >;
                                           permissions: import("zod").ZodOptional<
                                              import("zod").ZodRecord<
                                                 import("zod").ZodString,
                                                 import("zod").ZodArray<
                                                    import("zod").ZodString
                                                 >
                                              >
                                           >;
                                           userId: import("zod").ZodOptional<
                                              import("zod").ZodCoercedString<unknown>
                                           >;
                                           organizationId: import("zod").ZodOptional<
                                              import("zod").ZodCoercedString<unknown>
                                           >;
                                        },
                                        import("better-auth").$strip
                                     >;
                                     metadata: {
                                        openapi: {
                                           description: string;
                                           responses: {
                                              "200": {
                                                 description: string;
                                                 content: {
                                                    "application/json": {
                                                       schema: {
                                                          type: "object";
                                                          properties: {
                                                             id: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             createdAt: {
                                                                type: string;
                                                                format: string;
                                                                description: string;
                                                             };
                                                             updatedAt: {
                                                                type: string;
                                                                format: string;
                                                                description: string;
                                                             };
                                                             name: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             prefix: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             start: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             key: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             enabled: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             expiresAt: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             referenceId: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             lastRefillAt: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             lastRequest: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             metadata: {
                                                                type: string;
                                                                nullable: boolean;
                                                                additionalProperties: boolean;
                                                                description: string;
                                                             };
                                                             rateLimitMax: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             rateLimitTimeWindow: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             remaining: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             refillAmount: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             refillInterval: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             rateLimitEnabled: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             requestCount: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             permissions: {
                                                                type: string;
                                                                nullable: boolean;
                                                                additionalProperties: {
                                                                   type: string;
                                                                   items: {
                                                                      type: string;
                                                                   };
                                                                };
                                                                description: string;
                                                             };
                                                          };
                                                          required: string[];
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     };
                                  },
                                  {
                                     key: string;
                                     metadata: any;
                                     permissions: any;
                                     id: string;
                                     configId: string;
                                     name: string | null;
                                     start: string | null;
                                     prefix: string | null;
                                     referenceId: string;
                                     refillInterval: number | null;
                                     refillAmount: number | null;
                                     lastRefillAt: Date | null;
                                     enabled: boolean;
                                     rateLimitEnabled: boolean;
                                     rateLimitTimeWindow: number | null;
                                     rateLimitMax: number | null;
                                     requestCount: number;
                                     remaining: number | null;
                                     lastRequest: Date | null;
                                     expiresAt: Date | null;
                                     createdAt: Date;
                                     updatedAt: Date;
                                  }
                               >;
                               verifyApiKey: import("better-call").StrictEndpoint<
                                  string,
                                  {
                                     method: "POST";
                                     body: import("zod").ZodObject<
                                        {
                                           configId: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           key: import("zod").ZodString;
                                           permissions: import("zod").ZodOptional<
                                              import("zod").ZodRecord<
                                                 import("zod").ZodString,
                                                 import("zod").ZodArray<
                                                    import("zod").ZodString
                                                 >
                                              >
                                           >;
                                        },
                                        import("better-auth").$strip
                                     >;
                                  },
                                  | {
                                       valid: boolean;
                                       error: {
                                          message: import("better-auth").RawError<"INVALID_API_KEY">;
                                          code: "KEY_NOT_FOUND";
                                       };
                                       key: null;
                                    }
                                  | {
                                       valid: boolean;
                                       error: {
                                          message: string | undefined;
                                          code: string;
                                          cause?: unknown;
                                       };
                                       key: null;
                                    }
                                  | {
                                       valid: boolean;
                                       error: {
                                          message: import("better-auth").RawError<"INVALID_API_KEY">;
                                          code: "INVALID_API_KEY";
                                       };
                                       key: null;
                                    }
                                  | {
                                       valid: boolean;
                                       error: null;
                                       key: Omit<
                                          import("@better-auth/api-key").ApiKey,
                                          "key"
                                       > | null;
                                    }
                               >;
                               getApiKey: import("better-call").StrictEndpoint<
                                  "/api-key/get",
                                  {
                                     method: "GET";
                                     query: import("zod").ZodObject<
                                        {
                                           configId: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           id: import("zod").ZodString;
                                        },
                                        import("better-auth").$strip
                                     >;
                                     use: ((
                                        inputContext: import("better-call").MiddlewareInputContext<
                                           import("better-call").MiddlewareOptions
                                        >,
                                     ) => Promise<{
                                        session: {
                                           session: Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              userId: string;
                                              expiresAt: Date;
                                              token: string;
                                              ipAddress?:
                                                 | string
                                                 | null
                                                 | undefined;
                                              userAgent?:
                                                 | string
                                                 | null
                                                 | undefined;
                                           };
                                           user: Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              email: string;
                                              emailVerified: boolean;
                                              name: string;
                                              image?: string | null | undefined;
                                           };
                                        };
                                     }>)[];
                                     metadata: {
                                        openapi: {
                                           description: string;
                                           responses: {
                                              "200": {
                                                 description: string;
                                                 content: {
                                                    "application/json": {
                                                       schema: {
                                                          type: "object";
                                                          properties: {
                                                             id: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             name: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             start: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             prefix: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             userId: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             refillInterval: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             refillAmount: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             lastRefillAt: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             enabled: {
                                                                type: string;
                                                                description: string;
                                                                default: boolean;
                                                             };
                                                             rateLimitEnabled: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             rateLimitTimeWindow: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             rateLimitMax: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             requestCount: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             remaining: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             lastRequest: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             expiresAt: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             createdAt: {
                                                                type: string;
                                                                format: string;
                                                                description: string;
                                                             };
                                                             updatedAt: {
                                                                type: string;
                                                                format: string;
                                                                description: string;
                                                             };
                                                             metadata: {
                                                                type: string;
                                                                nullable: boolean;
                                                                additionalProperties: boolean;
                                                                description: string;
                                                             };
                                                             permissions: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                          };
                                                          required: string[];
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     };
                                  },
                                  {
                                     metadata: Record<string, any> | null;
                                     permissions: {
                                        [key: string]: string[];
                                     } | null;
                                     id: string;
                                     configId: string;
                                     name: string | null;
                                     start: string | null;
                                     prefix: string | null;
                                     referenceId: string;
                                     refillInterval: number | null;
                                     refillAmount: number | null;
                                     lastRefillAt: Date | null;
                                     enabled: boolean;
                                     rateLimitEnabled: boolean;
                                     rateLimitTimeWindow: number | null;
                                     rateLimitMax: number | null;
                                     requestCount: number;
                                     remaining: number | null;
                                     lastRequest: Date | null;
                                     expiresAt: Date | null;
                                     createdAt: Date;
                                     updatedAt: Date;
                                  }
                               >;
                               updateApiKey: import("better-call").StrictEndpoint<
                                  "/api-key/update",
                                  {
                                     method: "POST";
                                     body: import("zod").ZodObject<
                                        {
                                           configId: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           keyId: import("zod").ZodString;
                                           userId: import("zod").ZodOptional<
                                              import("zod").ZodCoercedString<unknown>
                                           >;
                                           name: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           enabled: import("zod").ZodOptional<
                                              import("zod").ZodBoolean
                                           >;
                                           remaining: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           refillAmount: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           refillInterval: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           metadata: import("zod").ZodOptional<
                                              import("zod").ZodAny
                                           >;
                                           expiresIn: import("zod").ZodNullable<
                                              import("zod").ZodOptional<
                                                 import("zod").ZodNumber
                                              >
                                           >;
                                           rateLimitEnabled: import("zod").ZodOptional<
                                              import("zod").ZodBoolean
                                           >;
                                           rateLimitTimeWindow: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           rateLimitMax: import("zod").ZodOptional<
                                              import("zod").ZodNumber
                                           >;
                                           permissions: import("zod").ZodNullable<
                                              import("zod").ZodOptional<
                                                 import("zod").ZodRecord<
                                                    import("zod").ZodString,
                                                    import("zod").ZodArray<
                                                       import("zod").ZodString
                                                    >
                                                 >
                                              >
                                           >;
                                        },
                                        import("better-auth").$strip
                                     >;
                                     metadata: {
                                        openapi: {
                                           description: string;
                                           responses: {
                                              "200": {
                                                 description: string;
                                                 content: {
                                                    "application/json": {
                                                       schema: {
                                                          type: "object";
                                                          properties: {
                                                             id: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             name: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             start: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             prefix: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             userId: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             refillInterval: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             refillAmount: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             lastRefillAt: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             enabled: {
                                                                type: string;
                                                                description: string;
                                                                default: boolean;
                                                             };
                                                             rateLimitEnabled: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             rateLimitTimeWindow: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             rateLimitMax: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             requestCount: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             remaining: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             lastRequest: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             expiresAt: {
                                                                type: string;
                                                                format: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             createdAt: {
                                                                type: string;
                                                                format: string;
                                                                description: string;
                                                             };
                                                             updatedAt: {
                                                                type: string;
                                                                format: string;
                                                                description: string;
                                                             };
                                                             metadata: {
                                                                type: string;
                                                                nullable: boolean;
                                                                additionalProperties: boolean;
                                                                description: string;
                                                             };
                                                             permissions: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                          };
                                                          required: string[];
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     };
                                  },
                                  {
                                     metadata: Record<string, any> | null;
                                     permissions: {
                                        [key: string]: string[];
                                     } | null;
                                     id: string;
                                     configId: string;
                                     name: string | null;
                                     start: string | null;
                                     prefix: string | null;
                                     referenceId: string;
                                     refillInterval: number | null;
                                     refillAmount: number | null;
                                     lastRefillAt: Date | null;
                                     enabled: boolean;
                                     rateLimitEnabled: boolean;
                                     rateLimitTimeWindow: number | null;
                                     rateLimitMax: number | null;
                                     requestCount: number;
                                     remaining: number | null;
                                     lastRequest: Date | null;
                                     expiresAt: Date | null;
                                     createdAt: Date;
                                     updatedAt: Date;
                                  }
                               >;
                               deleteApiKey: import("better-call").StrictEndpoint<
                                  "/api-key/delete",
                                  {
                                     method: "POST";
                                     body: import("zod").ZodObject<
                                        {
                                           configId: import("zod").ZodOptional<
                                              import("zod").ZodString
                                           >;
                                           keyId: import("zod").ZodString;
                                        },
                                        import("better-auth").$strip
                                     >;
                                     use: ((
                                        inputContext: import("better-call").MiddlewareInputContext<
                                           import("better-call").MiddlewareOptions
                                        >,
                                     ) => Promise<{
                                        session: {
                                           session: Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              userId: string;
                                              expiresAt: Date;
                                              token: string;
                                              ipAddress?:
                                                 | string
                                                 | null
                                                 | undefined;
                                              userAgent?:
                                                 | string
                                                 | null
                                                 | undefined;
                                           };
                                           user: Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              email: string;
                                              emailVerified: boolean;
                                              name: string;
                                              image?: string | null | undefined;
                                           };
                                        };
                                     }>)[];
                                     metadata: {
                                        openapi: {
                                           description: string;
                                           requestBody: {
                                              content: {
                                                 "application/json": {
                                                    schema: {
                                                       type: "object";
                                                       properties: {
                                                          keyId: {
                                                             type: string;
                                                             description: string;
                                                          };
                                                       };
                                                       required: string[];
                                                    };
                                                 };
                                              };
                                           };
                                           responses: {
                                              "200": {
                                                 description: string;
                                                 content: {
                                                    "application/json": {
                                                       schema: {
                                                          type: "object";
                                                          properties: {
                                                             success: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                          };
                                                          required: string[];
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     };
                                  },
                                  {
                                     success: boolean;
                                  }
                               >;
                               listApiKeys: import("better-call").StrictEndpoint<
                                  "/api-key/list",
                                  {
                                     method: "GET";
                                     use: ((
                                        inputContext: import("better-call").MiddlewareInputContext<
                                           import("better-call").MiddlewareOptions
                                        >,
                                     ) => Promise<{
                                        session: {
                                           session: Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              userId: string;
                                              expiresAt: Date;
                                              token: string;
                                              ipAddress?:
                                                 | string
                                                 | null
                                                 | undefined;
                                              userAgent?:
                                                 | string
                                                 | null
                                                 | undefined;
                                           };
                                           user: Record<string, any> & {
                                              id: string;
                                              createdAt: Date;
                                              updatedAt: Date;
                                              email: string;
                                              emailVerified: boolean;
                                              name: string;
                                              image?: string | null | undefined;
                                           };
                                        };
                                     }>)[];
                                     query: import("zod").ZodOptional<
                                        import("zod").ZodObject<
                                           {
                                              configId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              organizationId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              limit: import("zod").ZodOptional<
                                                 import("zod").ZodCoercedNumber<unknown>
                                              >;
                                              offset: import("zod").ZodOptional<
                                                 import("zod").ZodCoercedNumber<unknown>
                                              >;
                                              sortBy: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              sortDirection: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    asc: "asc";
                                                    desc: "desc";
                                                 }>
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >
                                     >;
                                     metadata: {
                                        openapi: {
                                           description: string;
                                           responses: {
                                              "200": {
                                                 description: string;
                                                 content: {
                                                    "application/json": {
                                                       schema: {
                                                          type: "object";
                                                          properties: {
                                                             apiKeys: {
                                                                type: string;
                                                                items: {
                                                                   type: string;
                                                                   properties: {
                                                                      id: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      name: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      start: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      prefix: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      userId: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      refillInterval: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      refillAmount: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      lastRefillAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      enabled: {
                                                                         type: string;
                                                                         description: string;
                                                                         default: boolean;
                                                                      };
                                                                      rateLimitEnabled: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      rateLimitTimeWindow: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      rateLimitMax: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      requestCount: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      remaining: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      lastRequest: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      expiresAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      createdAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                      updatedAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                      metadata: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         additionalProperties: boolean;
                                                                         description: string;
                                                                      };
                                                                      permissions: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                   };
                                                                   required: string[];
                                                                };
                                                             };
                                                             total: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                             limit: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                             offset: {
                                                                type: string;
                                                                nullable: boolean;
                                                                description: string;
                                                             };
                                                          };
                                                          required: string[];
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     };
                                  },
                                  {
                                     apiKeys: {
                                        metadata: Record<string, any> | null;
                                        permissions: {
                                           [key: string]: string[];
                                        } | null;
                                        id: string;
                                        configId: string;
                                        name: string | null;
                                        start: string | null;
                                        prefix: string | null;
                                        referenceId: string;
                                        refillInterval: number | null;
                                        refillAmount: number | null;
                                        lastRefillAt: Date | null;
                                        enabled: boolean;
                                        rateLimitEnabled: boolean;
                                        rateLimitTimeWindow: number | null;
                                        rateLimitMax: number | null;
                                        requestCount: number;
                                        remaining: number | null;
                                        lastRequest: Date | null;
                                        expiresAt: Date | null;
                                        createdAt: Date;
                                        updatedAt: Date;
                                     }[];
                                     total: number;
                                     limit: number | undefined;
                                     offset: number | undefined;
                                  }
                               >;
                               deleteAllExpiredApiKeys: import("better-call").StrictEndpoint<
                                  string,
                                  {
                                     method: "POST";
                                  },
                                  {
                                     success: boolean;
                                     error: unknown;
                                  }
                               >;
                            };
                            schema: {
                               apikey: {
                                  fields: {
                                     configId: {
                                        type: "string";
                                        required: true;
                                        defaultValue: string;
                                        input: false;
                                        index: true;
                                     };
                                     name: {
                                        type: "string";
                                        required: false;
                                        input: false;
                                     };
                                     start: {
                                        type: "string";
                                        required: false;
                                        input: false;
                                     };
                                     referenceId: {
                                        type: "string";
                                        required: true;
                                        input: false;
                                        index: true;
                                     };
                                     prefix: {
                                        type: "string";
                                        required: false;
                                        input: false;
                                     };
                                     key: {
                                        type: "string";
                                        required: true;
                                        input: false;
                                        index: true;
                                     };
                                     refillInterval: {
                                        type: "number";
                                        required: false;
                                        input: false;
                                     };
                                     refillAmount: {
                                        type: "number";
                                        required: false;
                                        input: false;
                                     };
                                     lastRefillAt: {
                                        type: "date";
                                        required: false;
                                        input: false;
                                     };
                                     enabled: {
                                        type: "boolean";
                                        required: false;
                                        input: false;
                                        defaultValue: true;
                                     };
                                     rateLimitEnabled: {
                                        type: "boolean";
                                        required: false;
                                        input: false;
                                        defaultValue: true;
                                     };
                                     rateLimitTimeWindow: {
                                        type: "number";
                                        required: false;
                                        input: false;
                                        defaultValue: number;
                                     };
                                     rateLimitMax: {
                                        type: "number";
                                        required: false;
                                        input: false;
                                        defaultValue: number;
                                     };
                                     requestCount: {
                                        type: "number";
                                        required: false;
                                        input: false;
                                        defaultValue: number;
                                     };
                                     remaining: {
                                        type: "number";
                                        required: false;
                                        input: false;
                                     };
                                     lastRequest: {
                                        type: "date";
                                        required: false;
                                        input: false;
                                     };
                                     expiresAt: {
                                        type: "date";
                                        required: false;
                                        input: false;
                                     };
                                     createdAt: {
                                        type: "date";
                                        required: true;
                                        input: false;
                                     };
                                     updatedAt: {
                                        type: "date";
                                        required: true;
                                        input: false;
                                     };
                                     permissions: {
                                        type: "string";
                                        required: false;
                                        input: false;
                                     };
                                     metadata: {
                                        type: "string";
                                        required: false;
                                        input: true;
                                        transform: {
                                           input(
                                              value: import("better-auth").DBPrimitive,
                                           ): string;
                                           output(
                                              value: import("better-auth").DBPrimitive,
                                           ): any;
                                        };
                                     };
                                  };
                               };
                            };
                            configurations: (import("@better-auth/api-key").ApiKeyConfigurationOptions &
                               Required<
                                  Pick<
                                     import("@better-auth/api-key").ApiKeyConfigurationOptions,
                                     | "apiKeyHeaders"
                                     | "defaultKeyLength"
                                     | "deferUpdates"
                                     | "disableKeyHashing"
                                     | "enableMetadata"
                                     | "enableSessionForAPIKeys"
                                     | "fallbackToDatabase"
                                     | "keyExpiration"
                                     | "maximumNameLength"
                                     | "maximumPrefixLength"
                                     | "minimumNameLength"
                                     | "minimumPrefixLength"
                                     | "rateLimit"
                                     | "requireName"
                                     | "startingCharactersConfig"
                                     | "storage"
                                  >
                               > & {
                                  keyExpiration: Required<{
                                     defaultExpiresIn?:
                                        | number
                                        | null
                                        | undefined;
                                     disableCustomExpiresTime?:
                                        | boolean
                                        | undefined;
                                     minExpiresIn?: number | undefined;
                                     maxExpiresIn?: number | undefined;
                                  }>;
                                  startingCharactersConfig: Required<{
                                     shouldStore?: boolean | undefined;
                                     charactersLength?: number | undefined;
                                  }>;
                                  rateLimit: Required<{
                                     enabled?: boolean | undefined;
                                     timeWindow?: number | undefined;
                                     maxRequests?: number | undefined;
                                  }>;
                               })[];
                         }
                       | {
                            id: "two-factor";
                            $InferServerPlugin: {
                               id: "two-factor";
                               endpoints: {
                                  enableTwoFactor: import("better-call").StrictEndpoint<
                                     "/two-factor/enable",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              password: import("zod").ZodString;
                                              issuer: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              session: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                              user: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 email: string;
                                                 emailVerified: boolean;
                                                 name: string;
                                                 image?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                totpURI: {
                                                                   type: string;
                                                                   description: string;
                                                                };
                                                                backupCodes: {
                                                                   type: string;
                                                                   items: {
                                                                      type: string;
                                                                   };
                                                                   description: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        totpURI: string;
                                        backupCodes: string[];
                                     }
                                  >;
                                  disableTwoFactor: import("better-call").StrictEndpoint<
                                     "/two-factor/disable",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              password: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              session: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                              user: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 email: string;
                                                 emailVerified: boolean;
                                                 name: string;
                                                 image?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        status: boolean;
                                     }
                                  >;
                                  verifyBackupCode: import("better-call").StrictEndpoint<
                                     "/two-factor/verify-backup-code",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              code: import("zod").ZodString;
                                              disableSession: import("zod").ZodOptional<
                                                 import("zod").ZodBoolean
                                              >;
                                              trustDevice: import("zod").ZodOptional<
                                                 import("zod").ZodBoolean
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              description: string;
                                              responses: {
                                                 "200": {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   type: string;
                                                                   properties: {
                                                                      id: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      email: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      emailVerified: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      name: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      image: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      twoFactorEnabled: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      createdAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                      updatedAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                   };
                                                                   required: string[];
                                                                   description: string;
                                                                };
                                                                session: {
                                                                   type: string;
                                                                   properties: {
                                                                      token: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      userId: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      createdAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                      expiresAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                   };
                                                                   required: string[];
                                                                   description: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        token: string | undefined;
                                        user:
                                           | import("better-auth/plugins").UserWithTwoFactor
                                           | (Record<string, any> & {
                                                id: string;
                                                createdAt: Date;
                                                updatedAt: Date;
                                                email: string;
                                                emailVerified: boolean;
                                                name: string;
                                                image?:
                                                   | string
                                                   | null
                                                   | undefined;
                                             });
                                     }
                                  >;
                                  generateBackupCodes: import("better-call").StrictEndpoint<
                                     "/two-factor/generate-backup-codes",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              password: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              session: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                              user: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 email: string;
                                                 emailVerified: boolean;
                                                 name: string;
                                                 image?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              description: string;
                                              responses: {
                                                 "200": {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                   description: string;
                                                                   enum: boolean[];
                                                                };
                                                                backupCodes: {
                                                                   type: string;
                                                                   items: {
                                                                      type: string;
                                                                   };
                                                                   description: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        status: boolean;
                                        backupCodes: string[];
                                     }
                                  >;
                                  viewBackupCodes: import("better-call").StrictEndpoint<
                                     string,
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                     },
                                     {
                                        status: boolean;
                                        backupCodes: string[];
                                     }
                                  >;
                                  sendTwoFactorOTP: import("better-call").StrictEndpoint<
                                     "/two-factor/send-otp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodOptional<
                                           import("zod").ZodObject<
                                              {
                                                 trustDevice: import("zod").ZodOptional<
                                                    import("zod").ZodBoolean
                                                 >;
                                              },
                                              import("better-auth").$strip
                                           >
                                        >;
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        status: boolean;
                                     }
                                  >;
                                  verifyTwoFactorOTP: import("better-call").StrictEndpoint<
                                     "/two-factor/verify-otp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              code: import("zod").ZodString;
                                              trustDevice: import("zod").ZodOptional<
                                                 import("zod").ZodBoolean
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 "200": {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                token: {
                                                                   type: string;
                                                                   description: string;
                                                                };
                                                                user: {
                                                                   type: string;
                                                                   properties: {
                                                                      id: {
                                                                         type: string;
                                                                         description: string;
                                                                      };
                                                                      email: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      emailVerified: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      name: {
                                                                         type: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      image: {
                                                                         type: string;
                                                                         format: string;
                                                                         nullable: boolean;
                                                                         description: string;
                                                                      };
                                                                      createdAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                      updatedAt: {
                                                                         type: string;
                                                                         format: string;
                                                                         description: string;
                                                                      };
                                                                   };
                                                                   required: string[];
                                                                   description: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     | {
                                          token: string;
                                          user: import("better-auth/plugins").UserWithTwoFactor;
                                       }
                                     | {
                                          token: string;
                                          user: Record<string, any> & {
                                             id: string;
                                             createdAt: Date;
                                             updatedAt: Date;
                                             email: string;
                                             emailVerified: boolean;
                                             name: string;
                                             image?: string | null | undefined;
                                          };
                                       }
                                  >;
                                  generateTOTP: import("better-call").StrictEndpoint<
                                     string,
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              secret: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                code: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        code: string;
                                     }
                                  >;
                                  getTOTPURI: import("better-call").StrictEndpoint<
                                     "/two-factor/get-totp-uri",
                                     {
                                        method: "POST";
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              session: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                              user: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 email: string;
                                                 emailVerified: boolean;
                                                 name: string;
                                                 image?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        body: import("zod").ZodObject<
                                           {
                                              password: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                totpURI: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        totpURI: string;
                                     }
                                  >;
                                  verifyTOTP: import("better-call").StrictEndpoint<
                                     "/two-factor/verify-totp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              code: import("zod").ZodString;
                                              trustDevice: import("zod").ZodOptional<
                                                 import("zod").ZodBoolean
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     | {
                                          token: string;
                                          user: import("better-auth/plugins").UserWithTwoFactor;
                                       }
                                     | {
                                          token: string;
                                          user: Record<string, any> & {
                                             id: string;
                                             createdAt: Date;
                                             updatedAt: Date;
                                             email: string;
                                             emailVerified: boolean;
                                             name: string;
                                             image?: string | null | undefined;
                                          };
                                       }
                                  >;
                               };
                               options: NoInfer<
                                  import("better-auth/plugins").TwoFactorOptions
                               >;
                               hooks: {
                                  after: {
                                     matcher(
                                        context: import("better-auth").HookEndpointContext,
                                     ): boolean;
                                     handler: (
                                        inputContext: import("better-call").MiddlewareInputContext<
                                           import("better-call").MiddlewareOptions
                                        >,
                                     ) => Promise<
                                        | {
                                             twoFactorRedirect: boolean;
                                          }
                                        | undefined
                                     >;
                                  }[];
                               };
                               schema: {
                                  user: {
                                     fields: {
                                        twoFactorEnabled: {
                                           type: "boolean";
                                           required: false;
                                           defaultValue: false;
                                           input: false;
                                        };
                                     };
                                  };
                                  twoFactor: {
                                     fields: {
                                        secret: {
                                           type: "string";
                                           required: true;
                                           returned: false;
                                           index: true;
                                        };
                                        backupCodes: {
                                           type: "string";
                                           required: true;
                                           returned: false;
                                        };
                                        userId: {
                                           type: "string";
                                           required: true;
                                           returned: false;
                                           references: {
                                              model: string;
                                              field: string;
                                           };
                                           index: true;
                                        };
                                     };
                                  };
                               };
                               rateLimit: {
                                  pathMatcher(path: string): boolean;
                                  window: number;
                                  max: number;
                               }[];
                               $ERROR_CODES: {
                                  OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
                                  OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
                                  TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
                                  TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
                                  BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
                                  INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
                                  INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
                                  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
                                  INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
                               };
                            };
                            atomListeners: {
                               matcher: (path: string) => boolean;
                               signal: "$sessionSignal";
                            }[];
                            pathMethods: {
                               "/two-factor/disable": "POST";
                               "/two-factor/enable": "POST";
                               "/two-factor/send-otp": "POST";
                               "/two-factor/generate-backup-codes": "POST";
                               "/two-factor/get-totp-uri": "POST";
                               "/two-factor/verify-totp": "POST";
                               "/two-factor/verify-otp": "POST";
                               "/two-factor/verify-backup-code": "POST";
                            };
                            fetchPlugins: {
                               id: string;
                               name: string;
                               hooks: {
                                  onSuccess(
                                     context: import("@better-fetch/fetch").SuccessContext<any>,
                                  ): Promise<void>;
                               };
                            }[];
                            $ERROR_CODES: {
                               OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
                               OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
                               TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
                               TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
                               BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
                               INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
                               INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
                               TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
                               INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
                            };
                         }
                       | {
                            id: "stripe-client";
                            $InferServerPlugin: {
                               id: "stripe";
                               endpoints: {
                                  stripeWebhook: import("better-call").StrictEndpoint<
                                     "/stripe/webhook",
                                     {
                                        method: "POST";
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                           scope: "server";
                                        };
                                        cloneRequest: true;
                                        disableBody: true;
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                               } & {
                                  upgradeSubscription: import("better-call").StrictEndpoint<
                                     "/subscription/upgrade",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              plan: import("zod").ZodString;
                                              annual: import("zod").ZodOptional<
                                                 import("zod").ZodBoolean
                                              >;
                                              referenceId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              subscriptionId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              customerType: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    user: "user";
                                                    organization: "organization";
                                                 }>
                                              >;
                                              metadata: import("zod").ZodOptional<
                                                 import("zod").ZodRecord<
                                                    import("zod").ZodString,
                                                    import("zod").ZodAny
                                                 >
                                              >;
                                              seats: import("zod").ZodOptional<
                                                 import("zod").ZodNumber
                                              >;
                                              locale: import("zod").ZodOptional<
                                                 import("zod").ZodCustom<
                                                    import("stripe").Stripe.Checkout.Session.Locale,
                                                    import("stripe").Stripe.Checkout.Session.Locale
                                                 >
                                              >;
                                              successUrl: import("zod").ZodDefault<
                                                 import("zod").ZodString
                                              >;
                                              cancelUrl: import("zod").ZodDefault<
                                                 import("zod").ZodString
                                              >;
                                              returnUrl: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              scheduleAtPeriodEnd: import("zod").ZodDefault<
                                                 import("zod").ZodBoolean
                                              >;
                                              disableRedirect: import("zod").ZodDefault<
                                                 import("zod").ZodBoolean
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                        };
                                        use: (
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<{
                                                   use: ((
                                                      inputContext: import("better-call").MiddlewareInputContext<
                                                         import("better-call").MiddlewareOptions
                                                      >,
                                                   ) => Promise<{
                                                      session: {
                                                         session: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            userId: string;
                                                            expiresAt: Date;
                                                            token: string;
                                                            ipAddress?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                            userAgent?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                         user: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            email: string;
                                                            emailVerified: boolean;
                                                            name: string;
                                                            image?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                      };
                                                   }>)[];
                                                }>,
                                             ) => Promise<{
                                                session: import("@better-auth/stripe").StripeCtxSession;
                                             }>)
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<
                                                   import("better-call").MiddlewareOptions
                                                >,
                                             ) => Promise<void>)
                                        )[];
                                     },
                                     | {
                                          url: string;
                                          redirect: boolean;
                                       }
                                     | {
                                          redirect: boolean;
                                          id: string;
                                          object: "checkout.session";
                                          adaptive_pricing:
                                             | import("stripe").Stripe.Checkout.Session.AdaptivePricing
                                             | null;
                                          after_expiration:
                                             | import("stripe").Stripe.Checkout.Session.AfterExpiration
                                             | null;
                                          allow_promotion_codes: boolean | null;
                                          amount_subtotal: number | null;
                                          amount_total: number | null;
                                          automatic_tax: import("stripe").Stripe.Checkout.Session.AutomaticTax;
                                          billing_address_collection:
                                             | import("stripe").Stripe.Checkout.Session.BillingAddressCollection
                                             | null;
                                          branding_settings?:
                                             | import("stripe").Stripe.Checkout.Session.BrandingSettings
                                             | undefined;
                                          cancel_url: string | null;
                                          client_reference_id: string | null;
                                          client_secret: string | null;
                                          collected_information:
                                             | import("stripe").Stripe.Checkout.Session.CollectedInformation
                                             | null;
                                          consent:
                                             | import("stripe").Stripe.Checkout.Session.Consent
                                             | null;
                                          consent_collection:
                                             | import("stripe").Stripe.Checkout.Session.ConsentCollection
                                             | null;
                                          created: number;
                                          currency: string | null;
                                          currency_conversion:
                                             | import("stripe").Stripe.Checkout.Session.CurrencyConversion
                                             | null;
                                          custom_fields: import("stripe").Stripe.Checkout.Session.CustomField[];
                                          custom_text: import("stripe").Stripe.Checkout.Session.CustomText;
                                          customer:
                                             | string
                                             | import("stripe").Stripe.Customer
                                             | import("stripe").Stripe.DeletedCustomer
                                             | null;
                                          customer_account: string | null;
                                          customer_creation:
                                             | import("stripe").Stripe.Checkout.Session.CustomerCreation
                                             | null;
                                          customer_details:
                                             | import("stripe").Stripe.Checkout.Session.CustomerDetails
                                             | null;
                                          customer_email: string | null;
                                          discounts:
                                             | import("stripe").Stripe.Checkout.Session.Discount[]
                                             | null;
                                          excluded_payment_method_types?:
                                             | string[]
                                             | undefined;
                                          expires_at: number;
                                          invoice:
                                             | string
                                             | import("stripe").Stripe.Invoice
                                             | null;
                                          invoice_creation:
                                             | import("stripe").Stripe.Checkout.Session.InvoiceCreation
                                             | null;
                                          line_items?:
                                             | import("stripe").Stripe.ApiList<
                                                  import("stripe").Stripe.LineItem
                                               >
                                             | undefined;
                                          livemode: boolean;
                                          locale:
                                             | import("stripe").Stripe.Checkout.Session.Locale
                                             | null;
                                          metadata:
                                             | import("stripe").Stripe.Metadata
                                             | null;
                                          mode: import("stripe").Stripe.Checkout.Session.Mode;
                                          name_collection?:
                                             | import("stripe").Stripe.Checkout.Session.NameCollection
                                             | undefined;
                                          optional_items?:
                                             | import("stripe").Stripe.Checkout.Session.OptionalItem[]
                                             | null
                                             | undefined;
                                          origin_context:
                                             | import("stripe").Stripe.Checkout.Session.OriginContext
                                             | null;
                                          payment_intent:
                                             | string
                                             | import("stripe").Stripe.PaymentIntent
                                             | null;
                                          payment_link:
                                             | string
                                             | import("stripe").Stripe.PaymentLink
                                             | null;
                                          payment_method_collection:
                                             | import("stripe").Stripe.Checkout.Session.PaymentMethodCollection
                                             | null;
                                          payment_method_configuration_details:
                                             | import("stripe").Stripe.Checkout.Session.PaymentMethodConfigurationDetails
                                             | null;
                                          payment_method_options:
                                             | import("stripe").Stripe.Checkout.Session.PaymentMethodOptions
                                             | null;
                                          payment_method_types: string[];
                                          payment_status: import("stripe").Stripe.Checkout.Session.PaymentStatus;
                                          permissions:
                                             | import("stripe").Stripe.Checkout.Session.Permissions
                                             | null;
                                          phone_number_collection?:
                                             | import("stripe").Stripe.Checkout.Session.PhoneNumberCollection
                                             | undefined;
                                          presentment_details?:
                                             | import("stripe").Stripe.Checkout.Session.PresentmentDetails
                                             | undefined;
                                          recovered_from: string | null;
                                          redirect_on_completion?:
                                             | import("stripe").Stripe.Checkout.Session.RedirectOnCompletion
                                             | undefined;
                                          return_url?: string | undefined;
                                          saved_payment_method_options:
                                             | import("stripe").Stripe.Checkout.Session.SavedPaymentMethodOptions
                                             | null;
                                          setup_intent:
                                             | string
                                             | import("stripe").Stripe.SetupIntent
                                             | null;
                                          shipping_address_collection:
                                             | import("stripe").Stripe.Checkout.Session.ShippingAddressCollection
                                             | null;
                                          shipping_cost:
                                             | import("stripe").Stripe.Checkout.Session.ShippingCost
                                             | null;
                                          shipping_options: import("stripe").Stripe.Checkout.Session.ShippingOption[];
                                          status:
                                             | import("stripe").Stripe.Checkout.Session.Status
                                             | null;
                                          submit_type:
                                             | import("stripe").Stripe.Checkout.Session.SubmitType
                                             | null;
                                          subscription:
                                             | string
                                             | import("stripe").Stripe.Subscription
                                             | null;
                                          success_url: string | null;
                                          tax_id_collection?:
                                             | import("stripe").Stripe.Checkout.Session.TaxIdCollection
                                             | undefined;
                                          total_details:
                                             | import("stripe").Stripe.Checkout.Session.TotalDetails
                                             | null;
                                          ui_mode:
                                             | import("stripe").Stripe.Checkout.Session.UiMode
                                             | null;
                                          url: string | null;
                                          wallet_options:
                                             | import("stripe").Stripe.Checkout.Session.WalletOptions
                                             | null;
                                          lastResponse: {
                                             headers: {
                                                [key: string]: string;
                                             };
                                             requestId: string;
                                             statusCode: number;
                                             apiVersion?: string | undefined;
                                             idempotencyKey?:
                                                | string
                                                | undefined;
                                             stripeAccount?: string | undefined;
                                          };
                                       }
                                  >;
                                  cancelSubscription: import("better-call").StrictEndpoint<
                                     "/subscription/cancel",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              referenceId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              subscriptionId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              customerType: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    user: "user";
                                                    organization: "organization";
                                                 }>
                                              >;
                                              returnUrl: import("zod").ZodString;
                                              disableRedirect: import("zod").ZodDefault<
                                                 import("zod").ZodBoolean
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                        };
                                        use: (
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<{
                                                   use: ((
                                                      inputContext: import("better-call").MiddlewareInputContext<
                                                         import("better-call").MiddlewareOptions
                                                      >,
                                                   ) => Promise<{
                                                      session: {
                                                         session: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            userId: string;
                                                            expiresAt: Date;
                                                            token: string;
                                                            ipAddress?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                            userAgent?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                         user: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            email: string;
                                                            emailVerified: boolean;
                                                            name: string;
                                                            image?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                      };
                                                   }>)[];
                                                }>,
                                             ) => Promise<{
                                                session: import("@better-auth/stripe").StripeCtxSession;
                                             }>)
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<
                                                   import("better-call").MiddlewareOptions
                                                >,
                                             ) => Promise<void>)
                                        )[];
                                     },
                                     {
                                        url: string;
                                        redirect: boolean;
                                     }
                                  >;
                                  restoreSubscription: import("better-call").StrictEndpoint<
                                     "/subscription/restore",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              referenceId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              subscriptionId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              customerType: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    user: "user";
                                                    organization: "organization";
                                                 }>
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                        };
                                        use: (
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<{
                                                   use: ((
                                                      inputContext: import("better-call").MiddlewareInputContext<
                                                         import("better-call").MiddlewareOptions
                                                      >,
                                                   ) => Promise<{
                                                      session: {
                                                         session: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            userId: string;
                                                            expiresAt: Date;
                                                            token: string;
                                                            ipAddress?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                            userAgent?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                         user: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            email: string;
                                                            emailVerified: boolean;
                                                            name: string;
                                                            image?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                      };
                                                   }>)[];
                                                }>,
                                             ) => Promise<{
                                                session: import("@better-auth/stripe").StripeCtxSession;
                                             }>)
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<
                                                   import("better-call").MiddlewareOptions
                                                >,
                                             ) => Promise<void>)
                                        )[];
                                     },
                                     import("stripe").Stripe.Response<
                                        import("stripe").Stripe.Subscription
                                     >
                                  >;
                                  listActiveSubscriptions: import("better-call").StrictEndpoint<
                                     "/subscription/list",
                                     {
                                        method: "GET";
                                        query: import("zod").ZodOptional<
                                           import("zod").ZodObject<
                                              {
                                                 referenceId: import("zod").ZodOptional<
                                                    import("zod").ZodString
                                                 >;
                                                 customerType: import("zod").ZodOptional<
                                                    import("zod").ZodEnum<{
                                                       user: "user";
                                                       organization: "organization";
                                                    }>
                                                 >;
                                              },
                                              import("better-auth").$strip
                                           >
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                        };
                                        use: (
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<{
                                                   use: ((
                                                      inputContext: import("better-call").MiddlewareInputContext<
                                                         import("better-call").MiddlewareOptions
                                                      >,
                                                   ) => Promise<{
                                                      session: {
                                                         session: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            userId: string;
                                                            expiresAt: Date;
                                                            token: string;
                                                            ipAddress?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                            userAgent?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                         user: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            email: string;
                                                            emailVerified: boolean;
                                                            name: string;
                                                            image?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                      };
                                                   }>)[];
                                                }>,
                                             ) => Promise<{
                                                session: import("@better-auth/stripe").StripeCtxSession;
                                             }>)
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<
                                                   import("better-call").MiddlewareOptions
                                                >,
                                             ) => Promise<void>)
                                        )[];
                                     },
                                     {
                                        limits:
                                           | Record<string, unknown>
                                           | undefined;
                                        priceId: string | undefined;
                                        id: string;
                                        plan: string;
                                        stripeCustomerId?: string | undefined;
                                        stripeSubscriptionId?:
                                           | string
                                           | undefined;
                                        trialStart?: Date | undefined;
                                        trialEnd?: Date | undefined;
                                        referenceId: string;
                                        status:
                                           | "active"
                                           | "canceled"
                                           | "incomplete"
                                           | "incomplete_expired"
                                           | "past_due"
                                           | "paused"
                                           | "trialing"
                                           | "unpaid";
                                        periodStart?: Date | undefined;
                                        periodEnd?: Date | undefined;
                                        cancelAtPeriodEnd?: boolean | undefined;
                                        cancelAt?: Date | undefined;
                                        canceledAt?: Date | undefined;
                                        endedAt?: Date | undefined;
                                        groupId?: string | undefined;
                                        seats?: number | undefined;
                                        billingInterval?:
                                           | "day"
                                           | "month"
                                           | "week"
                                           | "year"
                                           | undefined;
                                        stripeScheduleId?: string | undefined;
                                     }[]
                                  >;
                                  subscriptionSuccess: import("better-call").StrictEndpoint<
                                     "/subscription/success",
                                     {
                                        method: "GET";
                                        query: import("zod").ZodOptional<
                                           import("zod").ZodRecord<
                                              import("zod").ZodString,
                                              import("zod").ZodAny
                                           >
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                        };
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<void>)[];
                                     },
                                     never
                                  >;
                                  createBillingPortal: import("better-call").StrictEndpoint<
                                     "/subscription/billing-portal",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              locale: import("zod").ZodOptional<
                                                 import("zod").ZodCustom<
                                                    import("stripe").Stripe.Checkout.Session.Locale,
                                                    import("stripe").Stripe.Checkout.Session.Locale
                                                 >
                                              >;
                                              referenceId: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              customerType: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    user: "user";
                                                    organization: "organization";
                                                 }>
                                              >;
                                              returnUrl: import("zod").ZodDefault<
                                                 import("zod").ZodString
                                              >;
                                              disableRedirect: import("zod").ZodDefault<
                                                 import("zod").ZodBoolean
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                           };
                                        };
                                        use: (
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<{
                                                   use: ((
                                                      inputContext: import("better-call").MiddlewareInputContext<
                                                         import("better-call").MiddlewareOptions
                                                      >,
                                                   ) => Promise<{
                                                      session: {
                                                         session: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            userId: string;
                                                            expiresAt: Date;
                                                            token: string;
                                                            ipAddress?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                            userAgent?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                         user: Record<
                                                            string,
                                                            any
                                                         > & {
                                                            id: string;
                                                            createdAt: Date;
                                                            updatedAt: Date;
                                                            email: string;
                                                            emailVerified: boolean;
                                                            name: string;
                                                            image?:
                                                               | string
                                                               | null
                                                               | undefined;
                                                         };
                                                      };
                                                   }>)[];
                                                }>,
                                             ) => Promise<{
                                                session: import("@better-auth/stripe").StripeCtxSession;
                                             }>)
                                           | ((
                                                inputContext: import("better-call").MiddlewareInputContext<
                                                   import("better-call").MiddlewareOptions
                                                >,
                                             ) => Promise<void>)
                                        )[];
                                     },
                                     {
                                        url: string;
                                        redirect: boolean;
                                     }
                                  >;
                               };
                               init(ctx: import("better-auth").AuthContext):
                                  | {
                                       options: {
                                          databaseHooks: {
                                             user: {
                                                create: {
                                                   after(
                                                      user: {
                                                         id: string;
                                                         createdAt: Date;
                                                         updatedAt: Date;
                                                         email: string;
                                                         emailVerified: boolean;
                                                         name: string;
                                                         image?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                      } & import("@better-auth/stripe").WithStripeCustomerId,
                                                      ctx:
                                                         | import("better-auth").GenericEndpointContext
                                                         | null,
                                                   ): Promise<void>;
                                                };
                                                update: {
                                                   after(
                                                      user: {
                                                         id: string;
                                                         createdAt: Date;
                                                         updatedAt: Date;
                                                         email: string;
                                                         emailVerified: boolean;
                                                         name: string;
                                                         image?:
                                                            | string
                                                            | null
                                                            | undefined;
                                                      } & import("@better-auth/stripe").WithStripeCustomerId,
                                                      ctx:
                                                         | import("better-auth").GenericEndpointContext
                                                         | null,
                                                   ): Promise<void>;
                                                };
                                             };
                                          };
                                       };
                                    }
                                  | undefined;
                               schema: {
                                  user: {
                                     fields: {
                                        stripeCustomerId: {
                                           type: "string";
                                           required: false;
                                        };
                                     };
                                  };
                               } & {
                                  subscription: {
                                     fields: {
                                        plan: {
                                           type: "string";
                                           required: true;
                                        };
                                        referenceId: {
                                           type: "string";
                                           required: true;
                                        };
                                        stripeCustomerId: {
                                           type: "string";
                                           required: false;
                                        };
                                        stripeSubscriptionId: {
                                           type: "string";
                                           required: false;
                                        };
                                        status: {
                                           type: "string";
                                           defaultValue: string;
                                        };
                                        periodStart: {
                                           type: "date";
                                           required: false;
                                        };
                                        periodEnd: {
                                           type: "date";
                                           required: false;
                                        };
                                        trialStart: {
                                           type: "date";
                                           required: false;
                                        };
                                        trialEnd: {
                                           type: "date";
                                           required: false;
                                        };
                                        cancelAtPeriodEnd: {
                                           type: "boolean";
                                           required: false;
                                           defaultValue: false;
                                        };
                                        cancelAt: {
                                           type: "date";
                                           required: false;
                                        };
                                        canceledAt: {
                                           type: "date";
                                           required: false;
                                        };
                                        endedAt: {
                                           type: "date";
                                           required: false;
                                        };
                                        seats: {
                                           type: "number";
                                           required: false;
                                        };
                                        billingInterval: {
                                           type: "string";
                                           required: false;
                                        };
                                        stripeScheduleId: {
                                           type: "string";
                                           required: false;
                                        };
                                     };
                                  };
                               };
                               options: NoInfer<{
                                  stripeClient: any;
                                  stripeWebhookSecret: string;
                                  subscription: {
                                     enabled: true;
                                     plans: import("@better-auth/stripe").StripePlan[];
                                  };
                               }>;
                               $ERROR_CODES: {
                                  UNAUTHORIZED: import("better-auth").RawError<"UNAUTHORIZED">;
                                  INVALID_REQUEST_BODY: import("better-auth").RawError<"INVALID_REQUEST_BODY">;
                                  SUBSCRIPTION_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_NOT_FOUND">;
                                  SUBSCRIPTION_PLAN_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
                                  ALREADY_SUBSCRIBED_PLAN: import("better-auth").RawError<"ALREADY_SUBSCRIBED_PLAN">;
                                  REFERENCE_ID_NOT_ALLOWED: import("better-auth").RawError<"REFERENCE_ID_NOT_ALLOWED">;
                                  CUSTOMER_NOT_FOUND: import("better-auth").RawError<"CUSTOMER_NOT_FOUND">;
                                  UNABLE_TO_CREATE_CUSTOMER: import("better-auth").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
                                  UNABLE_TO_CREATE_BILLING_PORTAL: import("better-auth").RawError<"UNABLE_TO_CREATE_BILLING_PORTAL">;
                                  STRIPE_SIGNATURE_NOT_FOUND: import("better-auth").RawError<"STRIPE_SIGNATURE_NOT_FOUND">;
                                  STRIPE_WEBHOOK_SECRET_NOT_FOUND: import("better-auth").RawError<"STRIPE_WEBHOOK_SECRET_NOT_FOUND">;
                                  STRIPE_WEBHOOK_ERROR: import("better-auth").RawError<"STRIPE_WEBHOOK_ERROR">;
                                  FAILED_TO_CONSTRUCT_STRIPE_EVENT: import("better-auth").RawError<"FAILED_TO_CONSTRUCT_STRIPE_EVENT">;
                                  FAILED_TO_FETCH_PLANS: import("better-auth").RawError<"FAILED_TO_FETCH_PLANS">;
                                  EMAIL_VERIFICATION_REQUIRED: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED">;
                                  SUBSCRIPTION_NOT_ACTIVE: import("better-auth").RawError<"SUBSCRIPTION_NOT_ACTIVE">;
                                  SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: import("better-auth").RawError<"SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION">;
                                  SUBSCRIPTION_NOT_PENDING_CHANGE: import("better-auth").RawError<"SUBSCRIPTION_NOT_PENDING_CHANGE">;
                                  ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
                                  ORGANIZATION_SUBSCRIPTION_NOT_ENABLED: import("better-auth").RawError<"ORGANIZATION_SUBSCRIPTION_NOT_ENABLED">;
                                  AUTHORIZE_REFERENCE_REQUIRED: import("better-auth").RawError<"AUTHORIZE_REFERENCE_REQUIRED">;
                                  ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION: import("better-auth").RawError<"ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION">;
                                  ORGANIZATION_REFERENCE_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_REFERENCE_ID_REQUIRED">;
                               };
                            };
                            pathMethods: {
                               "/subscription/billing-portal": "POST";
                               "/subscription/restore": "POST";
                            };
                            $ERROR_CODES: {
                               UNAUTHORIZED: import("better-auth").RawError<"UNAUTHORIZED">;
                               INVALID_REQUEST_BODY: import("better-auth").RawError<"INVALID_REQUEST_BODY">;
                               SUBSCRIPTION_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_NOT_FOUND">;
                               SUBSCRIPTION_PLAN_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
                               ALREADY_SUBSCRIBED_PLAN: import("better-auth").RawError<"ALREADY_SUBSCRIBED_PLAN">;
                               REFERENCE_ID_NOT_ALLOWED: import("better-auth").RawError<"REFERENCE_ID_NOT_ALLOWED">;
                               CUSTOMER_NOT_FOUND: import("better-auth").RawError<"CUSTOMER_NOT_FOUND">;
                               UNABLE_TO_CREATE_CUSTOMER: import("better-auth").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
                               UNABLE_TO_CREATE_BILLING_PORTAL: import("better-auth").RawError<"UNABLE_TO_CREATE_BILLING_PORTAL">;
                               STRIPE_SIGNATURE_NOT_FOUND: import("better-auth").RawError<"STRIPE_SIGNATURE_NOT_FOUND">;
                               STRIPE_WEBHOOK_SECRET_NOT_FOUND: import("better-auth").RawError<"STRIPE_WEBHOOK_SECRET_NOT_FOUND">;
                               STRIPE_WEBHOOK_ERROR: import("better-auth").RawError<"STRIPE_WEBHOOK_ERROR">;
                               FAILED_TO_CONSTRUCT_STRIPE_EVENT: import("better-auth").RawError<"FAILED_TO_CONSTRUCT_STRIPE_EVENT">;
                               FAILED_TO_FETCH_PLANS: import("better-auth").RawError<"FAILED_TO_FETCH_PLANS">;
                               EMAIL_VERIFICATION_REQUIRED: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED">;
                               SUBSCRIPTION_NOT_ACTIVE: import("better-auth").RawError<"SUBSCRIPTION_NOT_ACTIVE">;
                               SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: import("better-auth").RawError<"SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION">;
                               SUBSCRIPTION_NOT_PENDING_CHANGE: import("better-auth").RawError<"SUBSCRIPTION_NOT_PENDING_CHANGE">;
                               ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
                               ORGANIZATION_SUBSCRIPTION_NOT_ENABLED: import("better-auth").RawError<"ORGANIZATION_SUBSCRIPTION_NOT_ENABLED">;
                               AUTHORIZE_REFERENCE_REQUIRED: import("better-auth").RawError<"AUTHORIZE_REFERENCE_REQUIRED">;
                               ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION: import("better-auth").RawError<"ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION">;
                               ORGANIZATION_REFERENCE_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_REFERENCE_ID_REQUIRED">;
                            };
                         }
                       | {
                            id: "additional-fields-client";
                            $InferServerPlugin: {
                               id: "additional-fields";
                               schema: {
                                  user: {
                                     fields: {
                                        telemetryConsent: {
                                           defaultValue: false;
                                           input: true;
                                           required: true;
                                           type: "boolean";
                                        };
                                     };
                                  };
                                  session: {
                                     fields: {};
                                  };
                               };
                            };
                         }
                       | {
                            id: "admin-client";
                            $InferServerPlugin: {
                               id: "admin";
                               init(): {
                                  options: {
                                     databaseHooks: {
                                        user: {
                                           create: {
                                              before(
                                                 user: {
                                                    id: string;
                                                    createdAt: Date;
                                                    updatedAt: Date;
                                                    email: string;
                                                    emailVerified: boolean;
                                                    name: string;
                                                    image?:
                                                       | string
                                                       | null
                                                       | undefined;
                                                 } & Record<string, unknown>,
                                              ): Promise<{
                                                 data: {
                                                    id: string;
                                                    createdAt: Date;
                                                    updatedAt: Date;
                                                    email: string;
                                                    emailVerified: boolean;
                                                    name: string;
                                                    image?:
                                                       | string
                                                       | null
                                                       | undefined;
                                                    role: string;
                                                 };
                                              }>;
                                           };
                                        };
                                        session: {
                                           create: {
                                              before(
                                                 session: {
                                                    id: string;
                                                    createdAt: Date;
                                                    updatedAt: Date;
                                                    userId: string;
                                                    expiresAt: Date;
                                                    token: string;
                                                    ipAddress?:
                                                       | string
                                                       | null
                                                       | undefined;
                                                    userAgent?:
                                                       | string
                                                       | null
                                                       | undefined;
                                                 } & Record<string, unknown>,
                                                 ctx:
                                                    | import("better-auth").GenericEndpointContext
                                                    | null,
                                              ): Promise<void>;
                                           };
                                        };
                                     };
                                  };
                               };
                               hooks: {
                                  after: {
                                     matcher(
                                        context: import("better-auth").HookEndpointContext,
                                     ): boolean;
                                     handler: (
                                        inputContext: import("better-call").MiddlewareInputContext<
                                           import("better-call").MiddlewareOptions
                                        >,
                                     ) => Promise<
                                        | import("better-auth/plugins").SessionWithImpersonatedBy[]
                                        | undefined
                                     >;
                                  }[];
                               };
                               endpoints: {
                                  setRole: import("better-call").StrictEndpoint<
                                     "/admin/set-role",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                              role: import("zod").ZodUnion<
                                                 readonly [
                                                    import("zod").ZodString,
                                                    import("zod").ZodArray<
                                                       import("zod").ZodString
                                                    >,
                                                 ]
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        requireHeaders: true;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                           $Infer: {
                                              body: {
                                                 userId: string;
                                                 role:
                                                    | "admin"
                                                    | "user"
                                                    | ("admin" | "user")[];
                                              };
                                           };
                                        };
                                     },
                                     {
                                        user: import("better-auth/plugins").UserWithRole;
                                     }
                                  >;
                                  getUser: import("better-call").StrictEndpoint<
                                     "/admin/get-user",
                                     {
                                        method: "GET";
                                        query: import("zod").ZodObject<
                                           {
                                              id: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     import("better-auth/plugins").UserWithRole
                                  >;
                                  createUser: import("better-call").StrictEndpoint<
                                     "/admin/create-user",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              password: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              name: import("zod").ZodString;
                                              role: import("zod").ZodOptional<
                                                 import("zod").ZodUnion<
                                                    readonly [
                                                       import("zod").ZodString,
                                                       import("zod").ZodArray<
                                                          import("zod").ZodString
                                                       >,
                                                    ]
                                                 >
                                              >;
                                              data: import("zod").ZodOptional<
                                                 import("zod").ZodRecord<
                                                    import("zod").ZodString,
                                                    import("zod").ZodAny
                                                 >
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                           $Infer: {
                                              body: {
                                                 email: string;
                                                 password?: string | undefined;
                                                 name: string;
                                                 role?:
                                                    | "admin"
                                                    | "user"
                                                    | ("admin" | "user")[]
                                                    | undefined;
                                                 data?:
                                                    | Record<string, any>
                                                    | undefined;
                                              };
                                           };
                                        };
                                     },
                                     {
                                        user: import("better-auth/plugins").UserWithRole;
                                     }
                                  >;
                                  adminUpdateUser: import("better-call").StrictEndpoint<
                                     "/admin/update-user",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                              data: import("zod").ZodRecord<
                                                 import("zod").ZodAny,
                                                 import("zod").ZodAny
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     import("better-auth/plugins").UserWithRole
                                  >;
                                  listUsers: import("better-call").StrictEndpoint<
                                     "/admin/list-users",
                                     {
                                        method: "GET";
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        query: import("zod").ZodObject<
                                           {
                                              searchValue: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              searchField: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    name: "name";
                                                    email: "email";
                                                 }>
                                              >;
                                              searchOperator: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    contains: "contains";
                                                    starts_with: "starts_with";
                                                    ends_with: "ends_with";
                                                 }>
                                              >;
                                              limit: import("zod").ZodOptional<
                                                 import("zod").ZodUnion<
                                                    [
                                                       import("zod").ZodString,
                                                       import("zod").ZodNumber,
                                                    ]
                                                 >
                                              >;
                                              offset: import("zod").ZodOptional<
                                                 import("zod").ZodUnion<
                                                    [
                                                       import("zod").ZodString,
                                                       import("zod").ZodNumber,
                                                    ]
                                                 >
                                              >;
                                              sortBy: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              sortDirection: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    asc: "asc";
                                                    desc: "desc";
                                                 }>
                                              >;
                                              filterField: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              filterValue: import("zod").ZodOptional<
                                                 import("zod").ZodUnion<
                                                    [
                                                       import("zod").ZodUnion<
                                                          [
                                                             import("zod").ZodUnion<
                                                                [
                                                                   import("zod").ZodUnion<
                                                                      [
                                                                         import("zod").ZodString,
                                                                         import("zod").ZodNumber,
                                                                      ]
                                                                   >,
                                                                   import("zod").ZodBoolean,
                                                                ]
                                                             >,
                                                             import("zod").ZodArray<
                                                                import("zod").ZodString
                                                             >,
                                                          ]
                                                       >,
                                                       import("zod").ZodArray<
                                                          import("zod").ZodNumber
                                                       >,
                                                    ]
                                                 >
                                              >;
                                              filterOperator: import("zod").ZodOptional<
                                                 import("zod").ZodEnum<{
                                                    eq: "eq";
                                                    ne: "ne";
                                                    gt: "gt";
                                                    gte: "gte";
                                                    lt: "lt";
                                                    lte: "lte";
                                                    in: "in";
                                                    not_in: "not_in";
                                                    contains: "contains";
                                                    starts_with: "starts_with";
                                                    ends_with: "ends_with";
                                                 }>
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                users: {
                                                                   type: string;
                                                                   items: {
                                                                      $ref: string;
                                                                   };
                                                                };
                                                                total: {
                                                                   type: string;
                                                                };
                                                                limit: {
                                                                   type: string;
                                                                };
                                                                offset: {
                                                                   type: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        users: import("better-auth/plugins").UserWithRole[];
                                        total: number;
                                     }
                                  >;
                                  listUserSessions: import("better-call").StrictEndpoint<
                                     "/admin/list-user-sessions",
                                     {
                                        method: "POST";
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                sessions: {
                                                                   type: string;
                                                                   items: {
                                                                      $ref: string;
                                                                   };
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        sessions: import("better-auth/plugins").SessionWithImpersonatedBy[];
                                     }
                                  >;
                                  unbanUser: import("better-call").StrictEndpoint<
                                     "/admin/unban-user",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        user: import("better-auth/plugins").UserWithRole;
                                     }
                                  >;
                                  banUser: import("better-call").StrictEndpoint<
                                     "/admin/ban-user",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                              banReason: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              banExpiresIn: import("zod").ZodOptional<
                                                 import("zod").ZodNumber
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        user: import("better-auth/plugins").UserWithRole;
                                     }
                                  >;
                                  impersonateUser: import("better-call").StrictEndpoint<
                                     "/admin/impersonate-user",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                session: {
                                                                   $ref: string;
                                                                };
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        session: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           userId: string;
                                           expiresAt: Date;
                                           token: string;
                                           ipAddress?:
                                              | string
                                              | null
                                              | undefined;
                                           userAgent?:
                                              | string
                                              | null
                                              | undefined;
                                        };
                                        user: import("better-auth/plugins").UserWithRole;
                                     }
                                  >;
                                  stopImpersonating: import("better-call").StrictEndpoint<
                                     "/admin/stop-impersonating",
                                     {
                                        method: "POST";
                                        requireHeaders: true;
                                     },
                                     {
                                        session: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           userId: string;
                                           expiresAt: Date;
                                           token: string;
                                           ipAddress?:
                                              | string
                                              | null
                                              | undefined;
                                           userAgent?:
                                              | string
                                              | null
                                              | undefined;
                                        } & Record<string, any>;
                                        user: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        } & Record<string, any>;
                                     }
                                  >;
                                  revokeUserSession: import("better-call").StrictEndpoint<
                                     "/admin/revoke-user-session",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              sessionToken: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  revokeUserSessions: import("better-call").StrictEndpoint<
                                     "/admin/revoke-user-sessions",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  removeUser: import("better-call").StrictEndpoint<
                                     "/admin/remove-user",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  setUserPassword: import("better-call").StrictEndpoint<
                                     "/admin/set-user-password",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              newPassword: import("zod").ZodString;
                                              userId: import("zod").ZodCoercedString<unknown>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              user: import("better-auth/plugins").UserWithRole;
                                              session: {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              summary: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        status: boolean;
                                     }
                                  >;
                                  userHasPermission: import("better-call").StrictEndpoint<
                                     "/admin/has-permission",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodIntersection<
                                           import("zod").ZodObject<
                                              {
                                                 userId: import("zod").ZodOptional<
                                                    import("zod").ZodCoercedString<unknown>
                                                 >;
                                                 role: import("zod").ZodOptional<
                                                    import("zod").ZodString
                                                 >;
                                              },
                                              import("better-auth").$strip
                                           >,
                                           import("zod").ZodUnion<
                                              readonly [
                                                 import("zod").ZodObject<
                                                    {
                                                       permission: import("zod").ZodRecord<
                                                          import("zod").ZodString,
                                                          import("zod").ZodArray<
                                                             import("zod").ZodString
                                                          >
                                                       >;
                                                       permissions: import("zod").ZodUndefined;
                                                    },
                                                    import("better-auth").$strip
                                                 >,
                                                 import("zod").ZodObject<
                                                    {
                                                       permission: import("zod").ZodUndefined;
                                                       permissions: import("zod").ZodRecord<
                                                          import("zod").ZodString,
                                                          import("zod").ZodArray<
                                                             import("zod").ZodString
                                                          >
                                                       >;
                                                    },
                                                    import("better-auth").$strip
                                                 >,
                                              ]
                                           >
                                        >;
                                        metadata: {
                                           openapi: {
                                              description: string;
                                              requestBody: {
                                                 content: {
                                                    "application/json": {
                                                       schema: {
                                                          type: "object";
                                                          properties: {
                                                             permissions: {
                                                                type: string;
                                                                description: string;
                                                             };
                                                          };
                                                          required: string[];
                                                       };
                                                    };
                                                 };
                                              };
                                              responses: {
                                                 "200": {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                error: {
                                                                   type: string;
                                                                };
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                           $Infer: {
                                              body: {
                                                 permissions: {
                                                    readonly user?:
                                                       | (
                                                            | "ban"
                                                            | "create"
                                                            | "delete"
                                                            | "get"
                                                            | "impersonate"
                                                            | "impersonate-admins"
                                                            | "list"
                                                            | "set-password"
                                                            | "set-role"
                                                            | "update"
                                                         )[]
                                                       | undefined;
                                                    readonly session?:
                                                       | (
                                                            | "delete"
                                                            | "list"
                                                            | "revoke"
                                                         )[]
                                                       | undefined;
                                                 };
                                              } & {
                                                 userId?: string | undefined;
                                                 role?:
                                                    | "admin"
                                                    | "user"
                                                    | undefined;
                                              };
                                           };
                                        };
                                     },
                                     {
                                        error: null;
                                        success: boolean;
                                     }
                                  >;
                               };
                               $ERROR_CODES: {
                                  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
                                  FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
                                  USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
                                  YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
                                  YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
                                  YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
                                  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
                                  YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
                                  YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
                                  YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
                                  YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
                                  YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
                                  YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
                                  BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
                                  YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
                                  NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
                                  YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
                                  YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
                                  YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
                                  YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
                                  INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
                               };
                               schema: {
                                  user: {
                                     fields: {
                                        role: {
                                           type: "string";
                                           required: false;
                                           input: false;
                                        };
                                        banned: {
                                           type: "boolean";
                                           defaultValue: false;
                                           required: false;
                                           input: false;
                                        };
                                        banReason: {
                                           type: "string";
                                           required: false;
                                           input: false;
                                        };
                                        banExpires: {
                                           type: "date";
                                           required: false;
                                           input: false;
                                        };
                                     };
                                  };
                                  session: {
                                     fields: {
                                        impersonatedBy: {
                                           type: "string";
                                           required: false;
                                        };
                                     };
                                  };
                               };
                               options: NoInfer<{
                                  ac: import("better-auth/plugins").AccessControl<{
                                     readonly user: readonly [
                                        "create",
                                        "list",
                                        "set-role",
                                        "ban",
                                        "impersonate",
                                        "impersonate-admins",
                                        "delete",
                                        "set-password",
                                        "get",
                                        "update",
                                     ];
                                     readonly session: readonly [
                                        "list",
                                        "revoke",
                                        "delete",
                                     ];
                                  }>;
                                  roles: {
                                     admin: import("better-auth/plugins").Role;
                                     user: import("better-auth/plugins").Role;
                                  };
                               }>;
                            };
                            getActions: () => {
                               admin: {
                                  checkRolePermission: <
                                     R extends "admin" | "user",
                                  >(
                                     data: {
                                        permissions: {
                                           readonly user?:
                                              | (
                                                   | "ban"
                                                   | "create"
                                                   | "delete"
                                                   | "get"
                                                   | "impersonate"
                                                   | "impersonate-admins"
                                                   | "list"
                                                   | "set-password"
                                                   | "set-role"
                                                   | "update"
                                                )[]
                                              | undefined;
                                           readonly session?:
                                              | ("delete" | "list" | "revoke")[]
                                              | undefined;
                                        };
                                     } & {
                                        role: R;
                                     },
                                  ) => boolean;
                               };
                            };
                            pathMethods: {
                               "/admin/list-users": "GET";
                               "/admin/stop-impersonating": "POST";
                            };
                            $ERROR_CODES: {
                               USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
                               FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
                               USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
                               YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
                               YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
                               YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
                               YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
                               YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
                               YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
                               YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
                               YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
                               YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
                               BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
                               YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
                               NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
                               YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
                               YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
                               YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
                               YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
                               INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
                            };
                         }
                       | {
                            id: "email-otp";
                            $InferServerPlugin: {
                               id: "email-otp";
                               init(ctx: import("better-auth").AuthContext):
                                  | {
                                       options: {
                                          emailVerification: {
                                             sendVerificationEmail(
                                                data: {
                                                   user: {
                                                      id: string;
                                                      createdAt: Date;
                                                      updatedAt: Date;
                                                      email: string;
                                                      emailVerified: boolean;
                                                      name: string;
                                                      image?:
                                                         | string
                                                         | null
                                                         | undefined;
                                                   };
                                                   url: string;
                                                   token: string;
                                                },
                                                request: Request | undefined,
                                             ): Promise<void>;
                                          };
                                       };
                                    }
                                  | undefined;
                               endpoints: {
                                  sendVerificationOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/send-verification-otp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              type: import("zod").ZodEnum<{
                                                 "sign-in": "sign-in";
                                                 "change-email": "change-email";
                                                 "email-verification": "email-verification";
                                                 "forget-password": "forget-password";
                                              }>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  createVerificationOTP: import("better-call").StrictEndpoint<
                                     string,
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              type: import("zod").ZodEnum<{
                                                 "sign-in": "sign-in";
                                                 "change-email": "change-email";
                                                 "email-verification": "email-verification";
                                                 "forget-password": "forget-password";
                                              }>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "string";
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     string
                                  >;
                                  getVerificationOTP: import("better-call").StrictEndpoint<
                                     string,
                                     {
                                        method: "GET";
                                        query: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              type: import("zod").ZodEnum<{
                                                 "sign-in": "sign-in";
                                                 "change-email": "change-email";
                                                 "email-verification": "email-verification";
                                                 "forget-password": "forget-password";
                                              }>;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 "200": {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                otp: {
                                                                   type: string;
                                                                   nullable: boolean;
                                                                   description: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     | {
                                          otp: null;
                                       }
                                     | {
                                          otp: string;
                                       }
                                  >;
                                  checkVerificationOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/check-verification-otp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              type: import("zod").ZodEnum<{
                                                 "sign-in": "sign-in";
                                                 "change-email": "change-email";
                                                 "email-verification": "email-verification";
                                                 "forget-password": "forget-password";
                                              }>;
                                              otp: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  verifyEmailOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/verify-email",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              otp: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                   description: string;
                                                                   enum: boolean[];
                                                                };
                                                                token: {
                                                                   type: string;
                                                                   nullable: boolean;
                                                                   description: string;
                                                                };
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     | {
                                          status: boolean;
                                          token: string;
                                          user: {
                                             id: string;
                                             createdAt: Date;
                                             updatedAt: Date;
                                             email: string;
                                             emailVerified: boolean;
                                             name: string;
                                             image?: string | null | undefined;
                                          } & Record<string, any>;
                                       }
                                     | {
                                          status: boolean;
                                          token: null;
                                          user: {
                                             id: string;
                                             createdAt: Date;
                                             updatedAt: Date;
                                             email: string;
                                             emailVerified: boolean;
                                             name: string;
                                             image?: string | null | undefined;
                                          } & Record<string, any>;
                                       }
                                  >;
                                  signInEmailOTP: import("better-call").StrictEndpoint<
                                     "/sign-in/email-otp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodIntersection<
                                           import("zod").ZodObject<
                                              {
                                                 email: import("zod").ZodString;
                                                 otp: import("zod").ZodString;
                                                 name: import("zod").ZodOptional<
                                                    import("zod").ZodString
                                                 >;
                                                 image: import("zod").ZodOptional<
                                                    import("zod").ZodString
                                                 >;
                                              },
                                              import("better-auth").$strip
                                           >,
                                           import("zod").ZodRecord<
                                              import("zod").ZodString,
                                              import("zod").ZodAny
                                           >
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                token: {
                                                                   type: string;
                                                                   description: string;
                                                                };
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                             required: string[];
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        token: string;
                                        user: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        };
                                     }
                                  >;
                                  requestPasswordResetEmailOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/request-password-reset",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                   description: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  forgetPasswordEmailOTP: import("better-call").StrictEndpoint<
                                     "/forget-password/email-otp",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                   description: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  resetPasswordEmailOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/reset-password",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodString;
                                              otp: import("zod").ZodString;
                                              password: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  requestEmailChangeEmailOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/request-email-change",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              newEmail: import("zod").ZodString;
                                              otp: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              session: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                              user: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 email: string;
                                                 emailVerified: boolean;
                                                 name: string;
                                                 image?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                                  changeEmailEmailOTP: import("better-call").StrictEndpoint<
                                     "/email-otp/change-email",
                                     {
                                        method: "POST";
                                        body: import("zod").ZodObject<
                                           {
                                              newEmail: import("zod").ZodString;
                                              otp: import("zod").ZodString;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<{
                                           session: {
                                              session: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 userId: string;
                                                 expiresAt: Date;
                                                 token: string;
                                                 ipAddress?:
                                                    | string
                                                    | null
                                                    | undefined;
                                                 userAgent?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                              user: Record<string, any> & {
                                                 id: string;
                                                 createdAt: Date;
                                                 updatedAt: Date;
                                                 email: string;
                                                 emailVerified: boolean;
                                                 name: string;
                                                 image?:
                                                    | string
                                                    | null
                                                    | undefined;
                                              };
                                           };
                                        }>)[];
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                success: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        success: boolean;
                                     }
                                  >;
                               };
                               hooks: {
                                  after: {
                                     matcher(
                                        context: import("better-auth").HookEndpointContext,
                                     ): boolean;
                                     handler: (
                                        inputContext: import("better-call").MiddlewareInputContext<
                                           import("better-call").MiddlewareOptions
                                        >,
                                     ) => Promise<void>;
                                  }[];
                               };
                               rateLimit: (
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/send-verification-otp";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/check-verification-otp";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/verify-email";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/sign-in/email-otp";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/request-password-reset";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/reset-password";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/forget-password/email-otp";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/request-email-change";
                                       window: number;
                                       max: number;
                                    }
                                  | {
                                       pathMatcher(
                                          path: string,
                                       ): path is "/email-otp/change-email";
                                       window: number;
                                       max: number;
                                    }
                               )[];
                               options: import("better-auth/plugins").EmailOTPOptions;
                               $ERROR_CODES: {
                                  OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
                                  INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
                                  TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
                               };
                            };
                            atomListeners: {
                               matcher: (
                                  path: string,
                               ) => path is
                                  | "/email-otp/verify-email"
                                  | "/sign-in/email-otp";
                               signal: "$sessionSignal";
                            }[];
                            $ERROR_CODES: {
                               OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
                               INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
                               TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
                            };
                         }
                       | {
                            id: "last-login-method-client";
                            getActions(): {
                               getLastUsedLoginMethod: () => string | null;
                               clearLastUsedLoginMethod: () => void;
                               isLastUsedLoginMethod: (
                                  method: string,
                               ) => boolean;
                            };
                         }
                       | {
                            id: "magic-link";
                            $InferServerPlugin: {
                               id: "magic-link";
                               endpoints: {
                                  signInMagicLink: import("better-call").StrictEndpoint<
                                     "/sign-in/magic-link",
                                     {
                                        method: "POST";
                                        requireHeaders: true;
                                        body: import("zod").ZodObject<
                                           {
                                              email: import("zod").ZodEmail;
                                              name: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              callbackURL: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              newUserCallbackURL: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              errorCallbackURL: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                status: {
                                                                   type: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        status: boolean;
                                     }
                                  >;
                                  magicLinkVerify: import("better-call").StrictEndpoint<
                                     "/magic-link/verify",
                                     {
                                        method: "GET";
                                        query: import("zod").ZodObject<
                                           {
                                              token: import("zod").ZodString;
                                              callbackURL: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              errorCallbackURL: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                              newUserCallbackURL: import("zod").ZodOptional<
                                                 import("zod").ZodString
                                              >;
                                           },
                                           import("better-auth").$strip
                                        >;
                                        use: ((
                                           inputContext: import("better-call").MiddlewareInputContext<
                                              import("better-call").MiddlewareOptions
                                           >,
                                        ) => Promise<void>)[];
                                        requireHeaders: true;
                                        metadata: {
                                           openapi: {
                                              operationId: string;
                                              description: string;
                                              responses: {
                                                 200: {
                                                    description: string;
                                                    content: {
                                                       "application/json": {
                                                          schema: {
                                                             type: "object";
                                                             properties: {
                                                                session: {
                                                                   $ref: string;
                                                                };
                                                                user: {
                                                                   $ref: string;
                                                                };
                                                             };
                                                          };
                                                       };
                                                    };
                                                 };
                                              };
                                           };
                                        };
                                     },
                                     {
                                        token: string;
                                        user: {
                                           id: string;
                                           createdAt: Date;
                                           updatedAt: Date;
                                           email: string;
                                           emailVerified: boolean;
                                           name: string;
                                           image?: string | null | undefined;
                                        };
                                     }
                                  >;
                               };
                               rateLimit: {
                                  pathMatcher(path: string): boolean;
                                  window: number;
                                  max: number;
                               }[];
                               options: import("better-auth/plugins").MagicLinkOptions;
                            };
                         }
                       | {
                            id: "organization";
                            $InferServerPlugin: import("better-auth/plugins").OrganizationPlugin<{
                               ac: import("better-auth/plugins").AccessControl<{
                                  readonly organization: readonly [
                                     "update",
                                     "delete",
                                  ];
                                  readonly member: readonly [
                                     "create",
                                     "update",
                                     "delete",
                                  ];
                                  readonly invitation: readonly [
                                     "create",
                                     "cancel",
                                  ];
                                  readonly team: readonly [
                                     "create",
                                     "update",
                                     "delete",
                                  ];
                                  readonly ac: readonly [
                                     "create",
                                     "read",
                                     "update",
                                     "delete",
                                  ];
                               }>;
                               roles: {
                                  admin: import("better-auth/plugins").Role;
                                  member: import("better-auth/plugins").Role;
                                  owner: import("better-auth/plugins").Role;
                               };
                               teams: {
                                  enabled: true;
                               };
                               schema: unknown;
                               dynamicAccessControl: {
                                  enabled: false;
                               };
                            }>;
                            getActions: (
                               $fetch: import("@better-fetch/fetch").BetterFetch,
                               _$store: import("better-auth").ClientStore,
                               co:
                                  | import("better-auth").BetterAuthClientOptions
                                  | undefined,
                            ) => {
                               $Infer: {
                                  ActiveOrganization: {
                                     members: {
                                        id: string;
                                        organizationId: string;
                                        role: "admin" | "member" | "owner";
                                        createdAt: Date;
                                        userId: string;
                                        teamId?: string | undefined;
                                        user: {
                                           id: string;
                                           email: string;
                                           name: string;
                                           image?: string | undefined;
                                        };
                                     }[];
                                     invitations: {
                                        id: string;
                                        organizationId: string;
                                        email: string;
                                        role: "admin" | "member" | "owner";
                                        status: import("better-auth/plugins").InvitationStatus;
                                        inviterId: string;
                                        expiresAt: Date;
                                        createdAt: Date;
                                        teamId?: string | undefined;
                                     }[];
                                     teams: {
                                        id: string;
                                        name: string;
                                        organizationId: string;
                                        createdAt: Date;
                                        updatedAt?: Date | undefined;
                                     }[];
                                  } & {
                                     id: string;
                                     name: string;
                                     slug: string;
                                     createdAt: Date;
                                     logo?: string | null | undefined;
                                     metadata?: any;
                                  };
                                  Organization: {
                                     id: string;
                                     name: string;
                                     slug: string;
                                     logo?: string | null | undefined;
                                     metadata?: any;
                                     createdAt: Date;
                                  };
                                  Invitation: {
                                     id: string;
                                     organizationId: string;
                                     email: string;
                                     role: "admin" | "member" | "owner";
                                     status: import("better-auth/plugins").InvitationStatus;
                                     inviterId: string;
                                     expiresAt: Date;
                                     createdAt: Date;
                                     teamId?: string | undefined;
                                  };
                                  Member: {
                                     id: string;
                                     organizationId: string;
                                     role: "admin" | "member" | "owner";
                                     createdAt: Date;
                                     userId: string;
                                     teamId?: string | undefined;
                                     user: {
                                        id: string;
                                        email: string;
                                        name: string;
                                        image?: string | undefined;
                                     };
                                  };
                                  Team: {
                                     id: string;
                                     name: string;
                                     organizationId: string;
                                     createdAt: Date;
                                     updatedAt?: Date | undefined;
                                  };
                               };
                               organization: {
                                  checkRolePermission: <
                                     R extends "admin" | "member" | "owner",
                                  >(
                                     data: {
                                        permissions: {
                                           readonly organization?:
                                              | ("delete" | "update")[]
                                              | undefined;
                                           readonly member?:
                                              | (
                                                   | "create"
                                                   | "delete"
                                                   | "update"
                                                )[]
                                              | undefined;
                                           readonly invitation?:
                                              | ("cancel" | "create")[]
                                              | undefined;
                                           readonly team?:
                                              | (
                                                   | "create"
                                                   | "delete"
                                                   | "update"
                                                )[]
                                              | undefined;
                                           readonly ac?:
                                              | (
                                                   | "create"
                                                   | "delete"
                                                   | "read"
                                                   | "update"
                                                )[]
                                              | undefined;
                                        };
                                     } & {
                                        role: R;
                                     },
                                  ) => boolean;
                               };
                            };
                            getAtoms: (
                               $fetch: import("@better-fetch/fetch").BetterFetch,
                            ) => {
                               $listOrg: import("nanostores").PreinitializedWritableAtom<boolean> &
                                  object;
                               $activeOrgSignal: import("nanostores").PreinitializedWritableAtom<boolean> &
                                  object;
                               $activeMemberSignal: import("nanostores").PreinitializedWritableAtom<boolean> &
                                  object;
                               $activeMemberRoleSignal: import("nanostores").PreinitializedWritableAtom<boolean> &
                                  object;
                               activeOrganization: import("better-auth/client").AuthQueryAtom<
                                  import("better-auth").Prettify<
                                     {
                                        id: string;
                                        name: string;
                                        slug: string;
                                        createdAt: Date;
                                        logo?: string | null | undefined;
                                        metadata?: any;
                                     } & {
                                        members: {
                                           id: string;
                                           organizationId: string;
                                           role: "admin" | "member" | "owner";
                                           createdAt: Date;
                                           userId: string;
                                           teamId?: string | undefined;
                                           user: {
                                              id: string;
                                              email: string;
                                              name: string;
                                              image?: string | undefined;
                                           };
                                        }[];
                                        invitations: {
                                           id: string;
                                           organizationId: string;
                                           email: string;
                                           role: "admin" | "member" | "owner";
                                           status: import("better-auth/plugins").InvitationStatus;
                                           inviterId: string;
                                           expiresAt: Date;
                                           createdAt: Date;
                                           teamId?: string | undefined;
                                        }[];
                                     }
                                  >
                               >;
                               listOrganizations: import("better-auth/client").AuthQueryAtom<
                                  {
                                     id: string;
                                     name: string;
                                     slug: string;
                                     createdAt: Date;
                                     logo?: string | null | undefined;
                                     metadata?: any;
                                  }[]
                               >;
                               activeMember: import("better-auth/client").AuthQueryAtom<{
                                  id: string;
                                  organizationId: string;
                                  userId: string;
                                  role: string;
                                  createdAt: Date;
                               }>;
                               activeMemberRole: import("better-auth/client").AuthQueryAtom<{
                                  role: string;
                               }>;
                            };
                            pathMethods: {
                               "/organization/get-full-organization": "GET";
                               "/organization/list-user-teams": "GET";
                            };
                            atomListeners: (
                               | {
                                    matcher(
                                       path: string,
                                    ): path is
                                       | "/organization/create"
                                       | "/organization/delete"
                                       | "/organization/update";
                                    signal: "$listOrg";
                                 }
                               | {
                                    matcher(path: string): boolean;
                                    signal: "$activeOrgSignal";
                                 }
                               | {
                                    matcher(path: string): boolean;
                                    signal: "$sessionSignal";
                                 }
                               | {
                                    matcher(path: string): boolean;
                                    signal: "$activeMemberSignal";
                                 }
                               | {
                                    matcher(path: string): boolean;
                                    signal: "$activeMemberRoleSignal";
                                 }
                            )[];
                            $ERROR_CODES: {
                               YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION">;
                               YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS">;
                               ORGANIZATION_ALREADY_EXISTS: import("better-auth").RawError<"ORGANIZATION_ALREADY_EXISTS">;
                               ORGANIZATION_SLUG_ALREADY_TAKEN: import("better-auth").RawError<"ORGANIZATION_SLUG_ALREADY_TAKEN">;
                               ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
                               USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION">;
                               YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION">;
                               YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION">;
                               NO_ACTIVE_ORGANIZATION: import("better-auth").RawError<"NO_ACTIVE_ORGANIZATION">;
                               USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION">;
                               MEMBER_NOT_FOUND: import("better-auth").RawError<"MEMBER_NOT_FOUND">;
                               ROLE_NOT_FOUND: import("better-auth").RawError<"ROLE_NOT_FOUND">;
                               YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM">;
                               TEAM_ALREADY_EXISTS: import("better-auth").RawError<"TEAM_ALREADY_EXISTS">;
                               TEAM_NOT_FOUND: import("better-auth").RawError<"TEAM_NOT_FOUND">;
                               YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER">;
                               YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER">;
                               YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER">;
                               YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION">;
                               USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION">;
                               INVITATION_NOT_FOUND: import("better-auth").RawError<"INVITATION_NOT_FOUND">;
                               YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION">;
                               EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION">;
                               YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION">;
                               INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION">;
                               YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE">;
                               FAILED_TO_RETRIEVE_INVITATION: import("better-auth").RawError<"FAILED_TO_RETRIEVE_INVITATION">;
                               YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS">;
                               UNABLE_TO_REMOVE_LAST_TEAM: import("better-auth").RawError<"UNABLE_TO_REMOVE_LAST_TEAM">;
                               YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER">;
                               ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: import("better-auth").RawError<"ORGANIZATION_MEMBERSHIP_LIMIT_REACHED">;
                               YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION">;
                               YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION">;
                               YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM">;
                               YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM">;
                               INVITATION_LIMIT_REACHED: import("better-auth").RawError<"INVITATION_LIMIT_REACHED">;
                               TEAM_MEMBER_LIMIT_REACHED: import("better-auth").RawError<"TEAM_MEMBER_LIMIT_REACHED">;
                               USER_IS_NOT_A_MEMBER_OF_THE_TEAM: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_TEAM">;
                               YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM: import("better-auth").RawError<"YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM">;
                               YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: import("better-auth").RawError<"YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM">;
                               YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER">;
                               YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER">;
                               YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION">;
                               YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION">;
                               MISSING_AC_INSTANCE: import("better-auth").RawError<"MISSING_AC_INSTANCE">;
                               YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE">;
                               YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE">;
                               TOO_MANY_ROLES: import("better-auth").RawError<"TOO_MANY_ROLES">;
                               INVALID_RESOURCE: import("better-auth").RawError<"INVALID_RESOURCE">;
                               ROLE_NAME_IS_ALREADY_TAKEN: import("better-auth").RawError<"ROLE_NAME_IS_ALREADY_TAKEN">;
                               CANNOT_DELETE_A_PRE_DEFINED_ROLE: import("better-auth").RawError<"CANNOT_DELETE_A_PRE_DEFINED_ROLE">;
                               ROLE_IS_ASSIGNED_TO_MEMBERS: import("better-auth").RawError<"ROLE_IS_ASSIGNED_TO_MEMBERS">;
                            };
                         }
                    )[];
                 },
                 FetchOptions
              >
           >
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            status: boolean;
         },
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   verifyEmail: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<{
            token: string;
            callbackURL?: string | undefined;
         }> &
            Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0: import("better-auth").Prettify<{
         query: {
            token: string;
            callbackURL?: string | undefined;
         };
         fetchOptions?: FetchOptions | undefined;
      }>,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         NonNullable<void | {
            status: boolean;
         }>,
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   getSession: <
      FetchOptions extends import("better-auth").ClientFetchOption<
         never,
         Partial<{
            disableCookieCache?: unknown;
            disableRefresh?: unknown;
         }> &
            Record<string, any>,
         Record<string, any> | undefined
      >,
   >(
      data_0?:
         | import("better-auth").Prettify<{
              query?:
                 | {
                      disableCookieCache?: unknown;
                      disableRefresh?: unknown;
                   }
                 | undefined;
              fetchOptions?: FetchOptions | undefined;
           }>
         | undefined,
      data_1?: FetchOptions | undefined,
   ) => Promise<
      import("@better-fetch/fetch").BetterFetchResponse<
         {
            user: import("better-auth").StripEmptyObjects<
               {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  email: string;
                  emailVerified: boolean;
                  name: string;
                  image?: string | null | undefined;
               } & {
                  twoFactorEnabled: boolean | null | undefined;
               } & {} & {} & {
                  stripeCustomerId?: string | null | undefined;
               } & {
                  telemetryConsent: boolean;
               } & {} & {
                  banned: boolean | null | undefined;
               } & {
                  banExpires?: Date | null | undefined;
                  banReason?: string | null | undefined;
                  role?: string | null | undefined;
               }
            >;
            session: import("better-auth").StripEmptyObjects<
               {
                  id: string;
                  createdAt: Date;
                  updatedAt: Date;
                  userId: string;
                  expiresAt: Date;
                  token: string;
                  ipAddress?: string | null | undefined;
                  userAgent?: string | null | undefined;
               } & {} & {} & {} & {
                  impersonatedBy?: string | null | undefined;
               } & {} & {
                  activeOrganizationId?: string | null | undefined;
                  activeTeamId?: string | null | undefined;
               }
            >;
         } | null,
         {
            code?: string | undefined;
            message?: string | undefined;
         },
         FetchOptions["throw"] extends true ? true : false
      >
   >;
} & {
   admin: {
      checkRolePermission: <R extends "admin" | "user">(
         data: {
            permissions: {
               readonly user?:
                  | (
                       | "ban"
                       | "create"
                       | "delete"
                       | "get"
                       | "impersonate"
                       | "impersonate-admins"
                       | "list"
                       | "set-password"
                       | "set-role"
                       | "update"
                    )[]
                  | undefined;
               readonly session?: ("delete" | "list" | "revoke")[] | undefined;
            };
         } & {
            role: R;
         },
      ) => boolean;
   };
} & {
   getLastUsedLoginMethod: () => string | null;
   clearLastUsedLoginMethod: () => void;
   isLastUsedLoginMethod: (method: string) => boolean;
} & {
   $Infer: {
      ActiveOrganization: {
         members: {
            id: string;
            organizationId: string;
            role: "admin" | "member" | "owner";
            createdAt: Date;
            userId: string;
            teamId?: string | undefined;
            user: {
               id: string;
               email: string;
               name: string;
               image?: string | undefined;
            };
         }[];
         invitations: {
            id: string;
            organizationId: string;
            email: string;
            role: "admin" | "member" | "owner";
            status: import("better-auth/plugins").InvitationStatus;
            inviterId: string;
            expiresAt: Date;
            createdAt: Date;
            teamId?: string | undefined;
         }[];
         teams: {
            id: string;
            name: string;
            organizationId: string;
            createdAt: Date;
            updatedAt?: Date | undefined;
         }[];
      } & {
         id: string;
         name: string;
         slug: string;
         createdAt: Date;
         logo?: string | null | undefined;
         metadata?: any;
      };
      Organization: {
         id: string;
         name: string;
         slug: string;
         logo?: string | null | undefined;
         metadata?: any;
         createdAt: Date;
      };
      Invitation: {
         id: string;
         organizationId: string;
         email: string;
         role: "admin" | "member" | "owner";
         status: import("better-auth/plugins").InvitationStatus;
         inviterId: string;
         expiresAt: Date;
         createdAt: Date;
         teamId?: string | undefined;
      };
      Member: {
         id: string;
         organizationId: string;
         role: "admin" | "member" | "owner";
         createdAt: Date;
         userId: string;
         teamId?: string | undefined;
         user: {
            id: string;
            email: string;
            name: string;
            image?: string | undefined;
         };
      };
      Team: {
         id: string;
         name: string;
         organizationId: string;
         createdAt: Date;
         updatedAt?: Date | undefined;
      };
   };
   organization: {
      checkRolePermission: <R extends "admin" | "member" | "owner">(
         data: {
            permissions: {
               readonly organization?: ("delete" | "update")[] | undefined;
               readonly member?: ("create" | "delete" | "update")[] | undefined;
               readonly invitation?: ("cancel" | "create")[] | undefined;
               readonly team?: ("create" | "delete" | "update")[] | undefined;
               readonly ac?:
                  | ("create" | "delete" | "read" | "update")[]
                  | undefined;
            };
         } & {
            role: R;
         },
      ) => boolean;
   };
} & {
   useSession: () => {
      data: {
         user: import("better-auth").StripEmptyObjects<
            {
               id: string;
               createdAt: Date;
               updatedAt: Date;
               email: string;
               emailVerified: boolean;
               name: string;
               image?: string | null | undefined;
            } & {
               twoFactorEnabled: boolean | null | undefined;
            } & {} & {} & {
               stripeCustomerId?: string | null | undefined;
            } & {
               telemetryConsent: boolean;
            } & {} & {
               banned: boolean | null | undefined;
            } & {
               banExpires?: Date | null | undefined;
               banReason?: string | null | undefined;
               role?: string | null | undefined;
            }
         >;
         session: import("better-auth").StripEmptyObjects<
            {
               id: string;
               createdAt: Date;
               updatedAt: Date;
               userId: string;
               expiresAt: Date;
               token: string;
               ipAddress?: string | null | undefined;
               userAgent?: string | null | undefined;
            } & {} & {} & {} & {
               impersonatedBy?: string | null | undefined;
            } & {} & {
               activeOrganizationId?: string | null | undefined;
               activeTeamId?: string | null | undefined;
            }
         >;
      } | null;
      isPending: boolean;
      isRefetching: boolean;
      error: import("@better-fetch/fetch").BetterFetchError | null;
      refetch: (
         queryParams?:
            | {
                 query?: import("better-auth").SessionQueryParams | undefined;
              }
            | undefined,
      ) => Promise<void>;
   };
   $Infer: {
      Session: {
         user: import("better-auth").StripEmptyObjects<
            {
               id: string;
               createdAt: Date;
               updatedAt: Date;
               email: string;
               emailVerified: boolean;
               name: string;
               image?: string | null | undefined;
            } & {
               twoFactorEnabled: boolean | null | undefined;
            } & {} & {} & {
               stripeCustomerId?: string | null | undefined;
            } & {
               telemetryConsent: boolean;
            } & {} & {
               banned: boolean | null | undefined;
            } & {
               banExpires?: Date | null | undefined;
               banReason?: string | null | undefined;
               role?: string | null | undefined;
            }
         >;
         session: import("better-auth").StripEmptyObjects<
            {
               id: string;
               createdAt: Date;
               updatedAt: Date;
               userId: string;
               expiresAt: Date;
               token: string;
               ipAddress?: string | null | undefined;
               userAgent?: string | null | undefined;
            } & {} & {} & {} & {
               impersonatedBy?: string | null | undefined;
            } & {} & {
               activeOrganizationId?: string | null | undefined;
               activeTeamId?: string | null | undefined;
            }
         >;
      };
   };
   $fetch: import("@better-fetch/fetch").BetterFetch<
      {
         plugins: (
            | import("@better-fetch/fetch").BetterFetchPlugin<
                 Record<string, any>
              >
            | {
                 id: string;
                 name: string;
                 hooks: {
                    onSuccess(
                       context: import("@better-fetch/fetch").SuccessContext<any>,
                    ): void;
                 };
              }
            | {
                 id: string;
                 name: string;
                 hooks: {
                    onSuccess:
                       | ((
                            context: import("@better-fetch/fetch").SuccessContext<any>,
                         ) => void | Promise<void>)
                       | undefined;
                    onError:
                       | ((
                            context: import("@better-fetch/fetch").ErrorContext,
                         ) => void | Promise<void>)
                       | undefined;
                    onRequest:
                       | (<T extends Record<string, any>>(
                            context: import("@better-fetch/fetch").RequestContext<T>,
                         ) =>
                            | void
                            | Promise<
                                 | void
                                 | import("@better-fetch/fetch").RequestContext
                              >
                            | import("@better-fetch/fetch").RequestContext)
                       | undefined;
                    onResponse:
                       | ((
                            context: import("@better-fetch/fetch").ResponseContext,
                         ) =>
                            | void
                            | Promise<
                                 | void
                                 | Response
                                 | import("@better-fetch/fetch").ResponseContext
                              >
                            | Response
                            | import("@better-fetch/fetch").ResponseContext)
                       | undefined;
                 };
              }
         )[];
         cache?: any;
         priority?: any;
         credentials?: any;
         headers?: any;
         integrity?: string | undefined;
         keepalive?: boolean | undefined;
         method: string;
         mode?: any;
         redirect?: any;
         referrer?: string | undefined;
         referrerPolicy?: any;
         signal?: AbortSignal | null | undefined;
         window?: null | undefined;
         onRetry?:
            | ((
                 response: import("@better-fetch/fetch").ResponseContext,
              ) => void | Promise<void>)
            | undefined;
         hookOptions?:
            | {
                 cloneResponse?: boolean | undefined;
              }
            | undefined;
         timeout?: number | undefined;
         customFetchImpl: import("@better-fetch/fetch").FetchEsque;
         baseURL: string;
         throw?: boolean | undefined;
         auth?:
            | {
                 type: "Bearer";
                 token:
                    | string
                    | Promise<string | undefined>
                    | (() => string | Promise<string | undefined> | undefined)
                    | undefined;
              }
            | {
                 type: "Basic";
                 username: string | (() => string | undefined) | undefined;
                 password: string | (() => string | undefined) | undefined;
              }
            | {
                 type: "Custom";
                 prefix: string | (() => string | undefined) | undefined;
                 value: string | (() => string | undefined) | undefined;
              }
            | undefined;
         body?: any;
         query?: any;
         params?: any;
         duplex?: "full" | "half" | undefined;
         jsonParser: (text: string) => any;
         retry?: import("@better-fetch/fetch").RetryOptions | undefined;
         retryAttempt?: number | undefined;
         output?:
            | import("@better-fetch/fetch").StandardSchemaV1<unknown, unknown>
            | {
                 new (
                    parts: Bun.BlobPart[],
                    name: string,
                    options?:
                       | (BlobPropertyBag & {
                            lastModified?: number | Date | undefined;
                         })
                       | undefined,
                 ): File;
                 prototype: File;
              }
            | {
                 new (
                    blobParts?: Bun.BlobPart[] | undefined,
                    options?: BlobPropertyBag | undefined,
                 ): Blob;
                 prototype: Blob;
              }
            | undefined;
         errorSchema?:
            | import("@better-fetch/fetch").StandardSchemaV1<unknown, unknown>
            | undefined;
         disableValidation?: boolean | undefined;
         disableSignal?: boolean | undefined;
      },
      unknown,
      unknown,
      {}
   >;
   $store: {
      notify: (
         signal?: "$sessionSignal" | Omit<string, "$sessionSignal"> | undefined,
      ) => void;
      listen: (
         signal: "$sessionSignal" | Omit<string, "$sessionSignal">,
         listener: (value: boolean, oldValue?: boolean | undefined) => void,
      ) => void;
      atoms: Record<string, import("nanostores").WritableAtom<any>>;
   };
   $ERROR_CODES: {
      BACKUP_CODES_NOT_ENABLED: import("better-auth").RawError<"BACKUP_CODES_NOT_ENABLED">;
      INVALID_BACKUP_CODE: import("better-auth").RawError<"INVALID_BACKUP_CODE">;
      INVALID_CODE: import("better-auth").RawError<"INVALID_CODE">;
      INVALID_TWO_FACTOR_COOKIE: import("better-auth").RawError<"INVALID_TWO_FACTOR_COOKIE">;
      OTP_HAS_EXPIRED: import("better-auth").RawError<"OTP_HAS_EXPIRED">;
      OTP_NOT_ENABLED: import("better-auth").RawError<"OTP_NOT_ENABLED">;
      TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: import("better-auth").RawError<"TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE">;
      TOTP_NOT_ENABLED: import("better-auth").RawError<"TOTP_NOT_ENABLED">;
      TWO_FACTOR_NOT_ENABLED: import("better-auth").RawError<"TWO_FACTOR_NOT_ENABLED">;
   } & {
      ALREADY_SUBSCRIBED_PLAN: import("better-auth").RawError<"ALREADY_SUBSCRIBED_PLAN">;
      AUTHORIZE_REFERENCE_REQUIRED: import("better-auth").RawError<"AUTHORIZE_REFERENCE_REQUIRED">;
      CUSTOMER_NOT_FOUND: import("better-auth").RawError<"CUSTOMER_NOT_FOUND">;
      EMAIL_VERIFICATION_REQUIRED: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED">;
      FAILED_TO_CONSTRUCT_STRIPE_EVENT: import("better-auth").RawError<"FAILED_TO_CONSTRUCT_STRIPE_EVENT">;
      FAILED_TO_FETCH_PLANS: import("better-auth").RawError<"FAILED_TO_FETCH_PLANS">;
      INVALID_REQUEST_BODY: import("better-auth").RawError<"INVALID_REQUEST_BODY">;
      ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION: import("better-auth").RawError<"ORGANIZATION_HAS_ACTIVE_SUBSCRIPTION">;
      ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
      ORGANIZATION_REFERENCE_ID_REQUIRED: import("better-auth").RawError<"ORGANIZATION_REFERENCE_ID_REQUIRED">;
      ORGANIZATION_SUBSCRIPTION_NOT_ENABLED: import("better-auth").RawError<"ORGANIZATION_SUBSCRIPTION_NOT_ENABLED">;
      REFERENCE_ID_NOT_ALLOWED: import("better-auth").RawError<"REFERENCE_ID_NOT_ALLOWED">;
      STRIPE_SIGNATURE_NOT_FOUND: import("better-auth").RawError<"STRIPE_SIGNATURE_NOT_FOUND">;
      STRIPE_WEBHOOK_ERROR: import("better-auth").RawError<"STRIPE_WEBHOOK_ERROR">;
      STRIPE_WEBHOOK_SECRET_NOT_FOUND: import("better-auth").RawError<"STRIPE_WEBHOOK_SECRET_NOT_FOUND">;
      SUBSCRIPTION_NOT_ACTIVE: import("better-auth").RawError<"SUBSCRIPTION_NOT_ACTIVE">;
      SUBSCRIPTION_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_NOT_FOUND">;
      SUBSCRIPTION_NOT_PENDING_CHANGE: import("better-auth").RawError<"SUBSCRIPTION_NOT_PENDING_CHANGE">;
      SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION: import("better-auth").RawError<"SUBSCRIPTION_NOT_SCHEDULED_FOR_CANCELLATION">;
      SUBSCRIPTION_PLAN_NOT_FOUND: import("better-auth").RawError<"SUBSCRIPTION_PLAN_NOT_FOUND">;
      UNABLE_TO_CREATE_BILLING_PORTAL: import("better-auth").RawError<"UNABLE_TO_CREATE_BILLING_PORTAL">;
      UNABLE_TO_CREATE_CUSTOMER: import("better-auth").RawError<"UNABLE_TO_CREATE_CUSTOMER">;
      UNAUTHORIZED: import("better-auth").RawError<"UNAUTHORIZED">;
   } & {
      BANNED_USER: import("better-auth").RawError<"BANNED_USER">;
      FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
      INVALID_ROLE_TYPE: import("better-auth").RawError<"INVALID_ROLE_TYPE">;
      NO_DATA_TO_UPDATE: import("better-auth").RawError<"NO_DATA_TO_UPDATE">;
      USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
      YOU_ARE_NOT_ALLOWED_TO_BAN_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_BAN_USERS">;
      YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CHANGE_USERS_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_USERS">;
      YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_USERS">;
      YOU_ARE_NOT_ALLOWED_TO_GET_USER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_USER">;
      YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_IMPERSONATE_USERS">;
      YOU_ARE_NOT_ALLOWED_TO_LIST_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS">;
      YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_USERS_SESSIONS">;
      YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REVOKE_USERS_SESSIONS">;
      YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_NON_EXISTENT_VALUE">;
      YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_SET_USERS_PASSWORD">;
      YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_USERS">;
      YOU_CANNOT_BAN_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_BAN_YOURSELF">;
      YOU_CANNOT_IMPERSONATE_ADMINS: import("better-auth").RawError<"YOU_CANNOT_IMPERSONATE_ADMINS">;
      YOU_CANNOT_REMOVE_YOURSELF: import("better-auth").RawError<"YOU_CANNOT_REMOVE_YOURSELF">;
   } & {
      INVALID_OTP: import("better-auth").RawError<"INVALID_OTP">;
      OTP_EXPIRED: import("better-auth").RawError<"OTP_EXPIRED">;
      TOO_MANY_ATTEMPTS: import("better-auth").RawError<"TOO_MANY_ATTEMPTS">;
   } & {
      CANNOT_DELETE_A_PRE_DEFINED_ROLE: import("better-auth").RawError<"CANNOT_DELETE_A_PRE_DEFINED_ROLE">;
      EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION: import("better-auth").RawError<"EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION">;
      FAILED_TO_RETRIEVE_INVITATION: import("better-auth").RawError<"FAILED_TO_RETRIEVE_INVITATION">;
      INVALID_RESOURCE: import("better-auth").RawError<"INVALID_RESOURCE">;
      INVITATION_LIMIT_REACHED: import("better-auth").RawError<"INVITATION_LIMIT_REACHED">;
      INVITATION_NOT_FOUND: import("better-auth").RawError<"INVITATION_NOT_FOUND">;
      INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"INVITER_IS_NO_LONGER_A_MEMBER_OF_THE_ORGANIZATION">;
      MEMBER_NOT_FOUND: import("better-auth").RawError<"MEMBER_NOT_FOUND">;
      MISSING_AC_INSTANCE: import("better-auth").RawError<"MISSING_AC_INSTANCE">;
      NO_ACTIVE_ORGANIZATION: import("better-auth").RawError<"NO_ACTIVE_ORGANIZATION">;
      ORGANIZATION_ALREADY_EXISTS: import("better-auth").RawError<"ORGANIZATION_ALREADY_EXISTS">;
      ORGANIZATION_MEMBERSHIP_LIMIT_REACHED: import("better-auth").RawError<"ORGANIZATION_MEMBERSHIP_LIMIT_REACHED">;
      ORGANIZATION_NOT_FOUND: import("better-auth").RawError<"ORGANIZATION_NOT_FOUND">;
      ORGANIZATION_SLUG_ALREADY_TAKEN: import("better-auth").RawError<"ORGANIZATION_SLUG_ALREADY_TAKEN">;
      ROLE_IS_ASSIGNED_TO_MEMBERS: import("better-auth").RawError<"ROLE_IS_ASSIGNED_TO_MEMBERS">;
      ROLE_NAME_IS_ALREADY_TAKEN: import("better-auth").RawError<"ROLE_NAME_IS_ALREADY_TAKEN">;
      ROLE_NOT_FOUND: import("better-auth").RawError<"ROLE_NOT_FOUND">;
      TEAM_ALREADY_EXISTS: import("better-auth").RawError<"TEAM_ALREADY_EXISTS">;
      TEAM_MEMBER_LIMIT_REACHED: import("better-auth").RawError<"TEAM_MEMBER_LIMIT_REACHED">;
      TEAM_NOT_FOUND: import("better-auth").RawError<"TEAM_NOT_FOUND">;
      TOO_MANY_ROLES: import("better-auth").RawError<"TOO_MANY_ROLES">;
      UNABLE_TO_REMOVE_LAST_TEAM: import("better-auth").RawError<"UNABLE_TO_REMOVE_LAST_TEAM">;
      USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_A_MEMBER_OF_THIS_ORGANIZATION">;
      USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION: import("better-auth").RawError<"USER_IS_ALREADY_INVITED_TO_THIS_ORGANIZATION">;
      USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_ORGANIZATION">;
      USER_IS_NOT_A_MEMBER_OF_THE_TEAM: import("better-auth").RawError<"USER_IS_NOT_A_MEMBER_OF_THE_TEAM">;
      YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_ACCESS_THIS_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CANCEL_THIS_INVITATION">;
      YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM">;
      YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_NEW_TEAM_MEMBER">;
      YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_A_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_CREATE_TEAMS_IN_THIS_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_A_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_TEAMS_IN_THIS_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_MEMBER">;
      YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_DELETE_THIS_TEAM">;
      YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_GET_A_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USERS_TO_THIS_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_INVITE_USER_WITH_THIS_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_LIST_A_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_READ_A_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_REMOVE_A_TEAM_MEMBER">;
      YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_A_ROLE">;
      YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_MEMBER">;
      YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_ORGANIZATION">;
      YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM: import("better-auth").RawError<"YOU_ARE_NOT_ALLOWED_TO_UPDATE_THIS_TEAM">;
      YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION: import("better-auth").RawError<"YOU_ARE_NOT_A_MEMBER_OF_THIS_ORGANIZATION">;
      YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION: import("better-auth").RawError<"YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION">;
      YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_AS_THE_ONLY_OWNER">;
      YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER: import("better-auth").RawError<"YOU_CANNOT_LEAVE_THE_ORGANIZATION_WITHOUT_AN_OWNER">;
      YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM: import("better-auth").RawError<"YOU_CAN_NOT_ACCESS_THE_MEMBERS_OF_THIS_TEAM">;
      YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM: import("better-auth").RawError<"YOU_DO_NOT_HAVE_AN_ACTIVE_TEAM">;
      YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_ORGANIZATIONS">;
      YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS: import("better-auth").RawError<"YOU_HAVE_REACHED_THE_MAXIMUM_NUMBER_OF_TEAMS">;
      YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE: import("better-auth").RawError<"YOU_MUST_BE_IN_AN_ORGANIZATION_TO_CREATE_A_ROLE">;
   } & {
      USER_NOT_FOUND: import("better-auth").RawError<"USER_NOT_FOUND">;
      FAILED_TO_CREATE_USER: import("better-auth").RawError<"FAILED_TO_CREATE_USER">;
      FAILED_TO_CREATE_SESSION: import("better-auth").RawError<"FAILED_TO_CREATE_SESSION">;
      FAILED_TO_UPDATE_USER: import("better-auth").RawError<"FAILED_TO_UPDATE_USER">;
      FAILED_TO_GET_SESSION: import("better-auth").RawError<"FAILED_TO_GET_SESSION">;
      INVALID_PASSWORD: import("better-auth").RawError<"INVALID_PASSWORD">;
      INVALID_EMAIL: import("better-auth").RawError<"INVALID_EMAIL">;
      INVALID_EMAIL_OR_PASSWORD: import("better-auth").RawError<"INVALID_EMAIL_OR_PASSWORD">;
      INVALID_USER: import("better-auth").RawError<"INVALID_USER">;
      SOCIAL_ACCOUNT_ALREADY_LINKED: import("better-auth").RawError<"SOCIAL_ACCOUNT_ALREADY_LINKED">;
      PROVIDER_NOT_FOUND: import("better-auth").RawError<"PROVIDER_NOT_FOUND">;
      INVALID_TOKEN: import("better-auth").RawError<"INVALID_TOKEN">;
      TOKEN_EXPIRED: import("better-auth").RawError<"TOKEN_EXPIRED">;
      ID_TOKEN_NOT_SUPPORTED: import("better-auth").RawError<"ID_TOKEN_NOT_SUPPORTED">;
      FAILED_TO_GET_USER_INFO: import("better-auth").RawError<"FAILED_TO_GET_USER_INFO">;
      USER_EMAIL_NOT_FOUND: import("better-auth").RawError<"USER_EMAIL_NOT_FOUND">;
      EMAIL_NOT_VERIFIED: import("better-auth").RawError<"EMAIL_NOT_VERIFIED">;
      PASSWORD_TOO_SHORT: import("better-auth").RawError<"PASSWORD_TOO_SHORT">;
      PASSWORD_TOO_LONG: import("better-auth").RawError<"PASSWORD_TOO_LONG">;
      USER_ALREADY_EXISTS: import("better-auth").RawError<"USER_ALREADY_EXISTS">;
      USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: import("better-auth").RawError<"USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL">;
      EMAIL_CAN_NOT_BE_UPDATED: import("better-auth").RawError<"EMAIL_CAN_NOT_BE_UPDATED">;
      CREDENTIAL_ACCOUNT_NOT_FOUND: import("better-auth").RawError<"CREDENTIAL_ACCOUNT_NOT_FOUND">;
      ACCOUNT_NOT_FOUND: import("better-auth").RawError<"ACCOUNT_NOT_FOUND">;
      SESSION_EXPIRED: import("better-auth").RawError<"SESSION_EXPIRED">;
      FAILED_TO_UNLINK_LAST_ACCOUNT: import("better-auth").RawError<"FAILED_TO_UNLINK_LAST_ACCOUNT">;
      USER_ALREADY_HAS_PASSWORD: import("better-auth").RawError<"USER_ALREADY_HAS_PASSWORD">;
      CROSS_SITE_NAVIGATION_LOGIN_BLOCKED: import("better-auth").RawError<"CROSS_SITE_NAVIGATION_LOGIN_BLOCKED">;
      VERIFICATION_EMAIL_NOT_ENABLED: import("better-auth").RawError<"VERIFICATION_EMAIL_NOT_ENABLED">;
      EMAIL_ALREADY_VERIFIED: import("better-auth").RawError<"EMAIL_ALREADY_VERIFIED">;
      EMAIL_MISMATCH: import("better-auth").RawError<"EMAIL_MISMATCH">;
      SESSION_NOT_FRESH: import("better-auth").RawError<"SESSION_NOT_FRESH">;
      LINKED_ACCOUNT_ALREADY_EXISTS: import("better-auth").RawError<"LINKED_ACCOUNT_ALREADY_EXISTS">;
      INVALID_ORIGIN: import("better-auth").RawError<"INVALID_ORIGIN">;
      INVALID_CALLBACK_URL: import("better-auth").RawError<"INVALID_CALLBACK_URL">;
      INVALID_REDIRECT_URL: import("better-auth").RawError<"INVALID_REDIRECT_URL">;
      INVALID_ERROR_CALLBACK_URL: import("better-auth").RawError<"INVALID_ERROR_CALLBACK_URL">;
      INVALID_NEW_USER_CALLBACK_URL: import("better-auth").RawError<"INVALID_NEW_USER_CALLBACK_URL">;
      MISSING_OR_NULL_ORIGIN: import("better-auth").RawError<"MISSING_OR_NULL_ORIGIN">;
      CALLBACK_URL_REQUIRED: import("better-auth").RawError<"CALLBACK_URL_REQUIRED">;
      FAILED_TO_CREATE_VERIFICATION: import("better-auth").RawError<"FAILED_TO_CREATE_VERIFICATION">;
      FIELD_NOT_ALLOWED: import("better-auth").RawError<"FIELD_NOT_ALLOWED">;
      ASYNC_VALIDATION_NOT_SUPPORTED: import("better-auth").RawError<"ASYNC_VALIDATION_NOT_SUPPORTED">;
      VALIDATION_ERROR: import("better-auth").RawError<"VALIDATION_ERROR">;
      MISSING_FIELD: import("better-auth").RawError<"MISSING_FIELD">;
      METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED: import("better-auth").RawError<"METHOD_NOT_ALLOWED_DEFER_SESSION_REQUIRED">;
      BODY_MUST_BE_AN_OBJECT: import("better-auth").RawError<"BODY_MUST_BE_AN_OBJECT">;
      PASSWORD_ALREADY_SET: import("better-auth").RawError<"PASSWORD_ALREADY_SET">;
   };
};
//# sourceMappingURL=client.d.ts.map

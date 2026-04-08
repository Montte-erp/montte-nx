export interface HyprPayCustomer {
   id: string;
   teamId: string;
   name: string;
   email: string | null;
   phone: string | null;
   document: string | null;
   externalId: string | null;
   createdAt: string;
   updatedAt: string;
}

export interface HyprPayListResult<T> {
   items: T[];
   total: number;
   page: number;
   limit: number;
}

export interface CreateCustomerInput {
   name: string;
   email?: string;
   phone?: string;
   document?: string;
   externalId?: string;
}

export interface UpdateCustomerInput {
   name?: string;
   email?: string | null;
   phone?: string | null;
}

export interface ListCustomersInput {
   page?: number;
   limit?: number;
}

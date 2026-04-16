# @montte/hyprpay

SDK TypeScript para o HyprPay — gerencie o ciclo de vida de clientes com um cliente type-safe e baseado em resultados. Inclui plugin para [Better Auth](https://better-auth.com) com criação automática de clientes no signup.

## Instalação

```bash
npm install @montte/hyprpay
# ou
bun add @montte/hyprpay
```

## Uso

### Cliente

```typescript
import { createHyprPayClient } from "@montte/hyprpay";

const client = createHyprPayClient({
   apiKey: process.env.HYPRPAY_API_KEY!,
});
```

Todos os métodos retornam `ResultAsync` do [neverthrow](https://github.com/supermacro/neverthrow) — erros são tipados e nunca lançados.

### Clientes

```typescript
// Criar
const result = await client.customers.create({
   name: "Maria Silva",
   email: "maria@example.com",
   phone: "11999999999",
   document: "12345678901",
   externalId: "user_abc123", // ID do usuário no seu sistema
});

if (result.isErr()) {
   console.error(result.error.code); // "BAD_REQUEST" | "CONFLICT" | ...
} else {
   console.log(result.value.id);
}

// Buscar por ID externo
const customer = await client.customers.get("user_abc123");

// Listar
const listResult = await client.customers.list({ page: 1, limit: 20 });
const { items, total, pages } = listResult.unwrapOr({
   items: [],
   total: 0,
   page: 1,
   limit: 20,
   pages: 0,
});

// Atualizar
const updated = await client.customers.update("user_abc123", {
   name: "Maria Santos",
   email: null, // passe null para limpar o campo
});
```

### Tratamento de Erros

```typescript
import { HyprPayError } from "@montte/hyprpay";

const result = await client.customers.get("id-desconhecido");

result.match(
   (customer) => console.log(customer),
   (error) => {
      if (error.code === "NOT_FOUND") {
         // tratar 404
      }
      console.error(error.code, error.statusCode, error.message);
   },
);
```

| Code                | Status | Quando ocorre             |
| ------------------- | ------ | ------------------------- |
| `UNAUTHORIZED`      | 401    | Chave inválida ou ausente |
| `FORBIDDEN`         | 403    | Sem permissão             |
| `NOT_FOUND`         | 404    | Cliente não encontrado    |
| `BAD_REQUEST`       | 400    | Dados inválidos           |
| `CONFLICT`          | 409    | Cliente já existe         |
| `TOO_MANY_REQUESTS` | 429    | Rate limit excedido       |
| `INTERNAL_ERROR`    | 500    | Erro interno do servidor  |
| `NETWORK_ERROR`     | 0      | Falha de rede             |
| `TIMEOUT`           | 0      | Timeout na requisição     |

## Plugin Better Auth

Cria clientes no HyprPay automaticamente no signup.

### Servidor

```typescript
import { betterAuth } from "better-auth";
import { hyprpay } from "@montte/hyprpay/better-auth";

export const auth = betterAuth({
   plugins: [
      hyprpay({
         apiKey: process.env.HYPRPAY_API_KEY!,
         createCustomerOnSignUp: true,

         // opcional: customize os dados enviados ao HyprPay
         customerData: (user) => ({
            name: user.name,
            email: user.email,
            externalId: user.id,
         }),

         // opcional: execute lógica após o cliente ser criado
         onCustomerCreate: async (customer, user) => {
            console.log(
               `Cliente HyprPay ${customer.id} criado para ${user.email}`,
            );
         },
      }),
   ],
});
```

O plugin intercepta `/sign-up/email`, `/sign-up/email-otp` e `/sign-in/magic-link`. Falhas na criação do cliente são logadas mas nunca bloqueiam o fluxo de autenticação.

### Cliente

```typescript
import { createAuthClient } from "better-auth/client";
import { hyprpayClient } from "@montte/hyprpay/better-auth";

export const authClient = createAuthClient({
   plugins: [hyprpayClient()],
});
```

## Tipos

```typescript
import type {
   HyprPayClient,
   HyprPayClientConfig,
   HyprPayCustomer,
   HyprPayListResult,
   CreateCustomerInput,
   UpdateCustomerInput,
   ListCustomersInput,
} from "@montte/hyprpay";
```

## URL Base Customizada

```typescript
const client = createHyprPayClient({
   apiKey: process.env.HYPRPAY_API_KEY!,
   baseUrl: "https://sua-instancia.example.com",
});
```

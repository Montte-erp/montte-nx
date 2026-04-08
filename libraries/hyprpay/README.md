# @montte/hyprpay

SDK TypeScript para sincronizar o ciclo de vida de clientes com o Montte (HyprPay).

## Instalação

```bash
npm install @montte/hyprpay
```

## Quickstart

1. Acesse **Montte → Configurações → Chaves de API** e gere uma chave para o seu espaço.

2. Configure o cliente:

```typescript
import { createHyprPayClient } from "@montte/hyprpay";

const hyprpay = createHyprPayClient({
  apiKey: process.env.MONTTE_API_KEY,
});

await hyprpay.customers.create({
  name: "Maria Silva",
  email: "maria@exemplo.com",
  externalId: user.id, // ID do usuário no seu sistema
});
```

## API

### `customers.create(input)`

Cria um cliente no Montte.

```typescript
const customer = await hyprpay.customers.create({
  name: "Maria Silva",       // obrigatório
  email: "maria@ex.com",     // opcional
  phone: "11999999999",      // opcional
  document: "12345678901",   // opcional
  externalId: user.id,       // recomendado — necessário para .get() e .update()
});
```

### `customers.get(externalId)`

Busca um cliente pelo ID externo (ID do seu sistema).

```typescript
const customer = await hyprpay.customers.get(user.id);
```

### `customers.update(externalId, data)`

Atualiza um cliente.

```typescript
await hyprpay.customers.update(user.id, {
  email: "novo@email.com",
  phone: null, // aceita null para limpar o campo
});
```

### `customers.list(options?)`

Lista clientes com paginação.

```typescript
const { items, total, page, limit } = await hyprpay.customers.list({
  page: 1,   // padrão: 1
  limit: 20, // padrão: 20, máximo: 100
});
```

## Plugin better-auth

Cria clientes automaticamente no signup.

```typescript
import { betterAuth } from "better-auth";
import { hyprpay } from "@montte/hyprpay/better-auth";

export const auth = betterAuth({
  plugins: [
    hyprpay({
      apiKey: process.env.MONTTE_API_KEY,
      createCustomerOnSignUp: true,
      customerData: (user) => ({
        name: user.name,
        email: user.email,
        externalId: user.id,
      }),
      onCustomerCreate: async (customer, user) => {
        console.log("Customer created:", customer.id);
      },
    }),
  ],
});
```

## Erros

Todos os erros são instâncias de `HyprPayError` com `code` e `statusCode` tipados:

```typescript
import { HyprPayError } from "@montte/hyprpay";

try {
  await hyprpay.customers.get("id-desconhecido");
} catch (err) {
  if (err instanceof HyprPayError) {
    err.code;       // "NOT_FOUND" | "UNAUTHORIZED" | "FORBIDDEN" | ...
    err.statusCode; // 404
  }
}
```

| Code | Status | Quando ocorre |
|------|--------|---------------|
| `UNAUTHORIZED` | 401 | Chave inválida ou ausente |
| `FORBIDDEN` | 403 | Chave sem `teamId` no metadata |
| `NOT_FOUND` | 404 | Cliente não encontrado |
| `CONFLICT` | 409 | Nome de cliente já existe no espaço |
| `TOO_MANY_REQUESTS` | 429 | Rate limit excedido |
| `INTERNAL_ERROR` | 500 | Erro interno do servidor |
| `NETWORK_ERROR` | 0 | Falha de rede |
| `TIMEOUT` | 0 | Timeout após `timeoutMs` ms |

## Configuração avançada

```typescript
const hyprpay = createHyprPayClient({
  apiKey: process.env.MONTTE_API_KEY,
  baseUrl: "https://api.montte.com.br", // padrão
  timeoutMs: 10_000,                     // padrão: 10s
  retries: 2,                            // padrão: 2 tentativas em erros 5xx
});
```

# Astro no Montte

Reference de implementação para `apps/landing` (Astro 6, landing pública, blog, OG, RSS, endpoints e React islands). Use esta referência antes de mexer em qualquer código Astro.

## Escopo atual

`apps/landing` é a superfície pública do Montte.

- Astro `6.3.1` com `output: "static"`.
- Adapter `@astrojs/node` em modo `standalone` para suportar endpoints on-demand quando uma rota declara `prerender = false`.
- React integration para islands interativas.
- MDX, sitemap, RSS, OG image generation, Arcjet e Tailwind via Vite.
- Porta local: `3001`.

Comandos focados:

```bash
bun --filter landing typecheck
bun --filter landing build
bun --filter landing check
git diff --check
```

## Modelo mental

Astro deve ser usado como HTML-first:

- `.astro` para layout, páginas, blocos estáticos, SEO, blog e composição.
- React só para islands que precisam de estado, eventos, storage local, animação dependente de estado ou bibliotecas React-only.
- Por padrão, componentes de framework renderizam HTML no servidor e **não hidratam**. Só ficam interativos com diretivas `client:*`.
- Frontmatter de `.astro` roda no servidor/build e não vai para o browser.

Regra prática: se não precisa de interação no browser, não use React.

## Estrutura e rotas

Rotas vivem em `apps/landing/src/pages`.

- `index.astro`: home.
- `privacidade.astro`: página estática.
- `blog/index.astro`: listagem.
- `blog/[...slug].astro`: posts via content collection.
- `blog/categoria/[category].astro`: categoria.
- `rss.xml.ts`, `llms.txt.ts`, `open-graph/[...route].ts`: endpoints estáticos.
- `api/*`: endpoints on-demand quando necessário.

Regras:

- Páginas e endpoints são prerenderizados por padrão quando o projeto está em `output: "static"`.
- Declare `export const prerender = true` em páginas/endpoints que devem ser artefatos estáticos explícitos.
- Declare `export const prerender = false` só em endpoints/rotas que realmente precisam executar por request.
- Endpoint on-demand exige adapter configurado. O projeto já usa `@astrojs/node`.
- Não crie router manual. Astro usa file-based routing.

Pattern de página estática:

```astro
---
export const prerender = true;
import BaseLayout from "../layouts/base-layout.astro";
---

<BaseLayout title="Título — Montte" description="Descrição em pt-BR.">
   <section aria-label="Seção">
      Conteúdo
   </section>
</BaseLayout>
```

## Layout, SEO e JSON-LD

Use `src/layouts/base-layout.astro` como layout canônico.

Toda página pública deve definir:

- `title` em pt-BR.
- `description` específica.
- canonical correta.
- Open Graph via layout.
- JSON-LD quando a página representa artigo, FAQ, breadcrumb, organização ou lista.

Regras:

- `siteUrl` canônico atual: `https://montte.co`.
- `html lang="pt-BR"`.
- Use `new URL(path, siteUrl).toString()` para URLs absolutas.
- Para JSON-LD, use `<script is:inline type="application/ld+json" set:html={JSON.stringify(block)} />` apenas para dados serializados gerados no servidor.
- Não injete HTML arbitrário de usuário.
- Blog post deve usar `BlogPosting`, `BreadcrumbList` e `FAQPage` quando houver FAQ.
- Datas no Montte usam `dayjs`; em schema.org pode serializar com `.toISOString()` quando o dado já é `Date` de content collection.

## Content collections e blog

Astro 6 exige Content Layer API. No Montte, a configuração fica em `apps/landing/src/content.config.ts`.

Pattern atual:

```typescript
import { glob } from "astro/loaders";
import { defineCollection } from "astro:content";
import { z } from "astro/zod";

const blog = defineCollection({
   loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/blog" }),
   schema: ({ image }) =>
      z.object({
         title: z.string().max(90),
         description: z.string().min(80).max(360),
         publishedAt: z.coerce.date(),
         coverImage: image(),
      }),
});

export const collections = { blog };
```

Regras:

- Não use `src/content/config.ts`; Astro 6 usa `src/content.config.ts`.
- Toda collection precisa de `loader`.
- Use `glob()` para conteúdo local.
- Use `astro/zod`, não `zod`, em content config.
- Imagens de frontmatter devem usar `image()`.
- Ordenação de posts fica em helper (`src/lib/blog.ts`), não duplicada em toda rota.
- Para página dinâmica estática, use `getStaticPaths()` + `getCollection()`.
- Para renderizar MD/MDX, use `const { Content, headings } = await render(post)`.

Pattern de post:

```astro
---
export const prerender = true;
import { getCollection, render } from "astro:content";
import { sortBlogPosts } from "../../lib/blog";

export async function getStaticPaths() {
   const posts = sortBlogPosts(await getCollection("blog"));
   return posts.map((post) => ({
      params: { slug: post.id },
      props: { post },
   }));
}

const { post } = Astro.props;
const { Content, headings } = await render(post);
const tocHeadings = headings.filter((heading) => heading.depth === 2);
---

<article>
   <Content />
</article>
```

## React islands

Use React só quando há interação real.

Diretivas preferidas:

- `client:idle`: interação não crítica, formulários abaixo da dobra, consentimento, carrosséis não essenciais.
- `client:visible`: componentes pesados abaixo da dobra que só precisam hidratar quando entram na viewport.
- `client:load`: só quando a interação precisa estar pronta imediatamente no primeiro paint.
- `client:only="react"`: evitar. Use apenas quando o componente não pode renderizar no servidor.

Regras:

- Não hidrate componente meramente visual.
- Mantenha islands pequenas e perto do ponto de uso.
- Props passadas para islands devem ser serializáveis.
- Não passe funções, `Date`, `Map`, classes ou objetos não serializáveis como props para client components.
- Para animação, siga as regras do Montte: Tailwind-first; Motion só para enter/exit dependente de estado, `layoutId` ou gestures; animar apenas `transform` e `opacity`.
- Para estado persistido no browser, use helpers SSR-safe já permitidos (`foxact/use-local-storage`, etc.).

Pattern:

```astro
---
import { WaitlistForm } from "./waitlist-form";
---

<WaitlistForm client:idle />
```

## Server islands

Server islands (`server:defer`) servem para renderizar uma parte dinâmica/personalizada sem sacrificar cache da página principal.

Use apenas se houver necessidade clara de conteúdo dinâmico server-rendered dentro de página majoritariamente estática.

Regras:

- Exige adapter com suporte a on-demand rendering. O Node adapter suporta.
- Não use server island para conteúdo que pode ser prerenderizado.
- Defina fallback de carregamento acessível.
- Não mova lógica de aplicação autenticada do `apps/web` para landing.

Pattern conceitual:

```astro
<DynamicServerBlock server:defer>
   <p slot="fallback">Carregando…</p>
</DynamicServerBlock>
```

## Endpoints e APIs

Endpoints ficam em `src/pages/**/*.ts` e exportam métodos HTTP (`GET`, `POST`, etc.).

Regras Montte:

- **Sem `try/catch`** em endpoint Astro.
- Use `better-result` para parsing, chamadas externas e falhas esperadas.
- `export const prerender = false` em endpoint que roda por request.
- Retornos de erro visíveis ao usuário em pt-BR.
- Não vaze email, IP ou payload sensível em logs. Hash quando necessário.
- Valide input com Zod.
- Use `Response.json()` para JSON.
- Para endpoint estático (`rss.xml.ts`, `llms.txt.ts`, OG), mantenha `prerender = true`.

Pattern de endpoint on-demand sem `try/catch`:

```typescript
import { Result, TaggedError } from "better-result";
import type { APIContext } from "astro";
import { z } from "zod";

export const prerender = false;

const schema = z.object({
   email: z.email("Informe um e-mail válido."),
});

class LandingEndpointError extends TaggedError("LandingEndpointError")<{
   message: string;
   status: 400 | 500;
}>() {}

function json(body: Record<string, unknown>, status = 200) {
   return Response.json(body, { status });
}

async function readPayload(context: APIContext) {
   const body = await Result.tryPromise({
      try: () => context.request.json(),
      catch: () =>
         new LandingEndpointError({
            status: 400,
            message: "Não foi possível processar o envio.",
         }),
   });

   if (Result.isError(body)) return Result.err(body.error);

   const parsed = schema.safeParse(body.value);
   if (!parsed.success) {
      return Result.err(
         new LandingEndpointError({
            status: 400,
            message: parsed.error.issues[0]?.message ?? "Dados inválidos.",
         }),
      );
   }

   return Result.ok(parsed.data);
}

export async function POST(context: APIContext) {
   const payload = await readPayload(context);
   if (Result.isError(payload)) {
      return json({ ok: false, message: payload.error.message }, payload.error.status);
   }

   return json({ ok: true });
}
```

## Forms

Preferência por complexidade:

1. HTML form em `.astro` se a página é on-demand e não precisa de JS.
2. Astro Actions se precisar de backend type-safe chamado por client/form e a feature for local à landing.
3. React island com TanStack Form se precisar de estado rico no browser.

No Montte hoje, `WaitlistForm` usa React island + endpoint `/api/waitlist`.

Regras:

- Mensagens em pt-BR.
- `id`, `name`, `aria-invalid`, `required` quando aplicável.
- `onInput`, não `onChange`, em inputs estruturados seguindo padrão Montte.
- **Sem `try/catch` em submit handlers novos**. Extraia chamadas para helpers que retornam `Result`.
- Não bloquear o HTML principal por causa de formulário não crítico; hidrate com `client:idle`.

Pattern de submit React sem `try/catch`:

```typescript
import { Result, TaggedError } from "better-result";

class WaitlistClientError extends TaggedError("WaitlistClientError")<{
   message: string;
}>() {}

async function submitWaitlist(email: string) {
   const response = await Result.tryPromise({
      try: () =>
         fetch("/api/waitlist", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email }),
         }),
      catch: () =>
         new WaitlistClientError({
            message: "Não foi possível registrar seu e-mail. Tente novamente.",
         }),
   });

   if (Result.isError(response)) return Result.err(response.error);

   const json = await Result.tryPromise({
      try: () => response.value.json(),
      catch: () =>
         new WaitlistClientError({
            message: "Não foi possível ler a resposta do servidor.",
         }),
   });

   if (Result.isError(json)) return Result.err(json.error);

   return Result.ok(json.value);
}
```

## Imagens e assets

Use Astro assets quando a imagem é importada/processada pelo build.

- `Picture`/`Image` de `astro:assets` para imagens locais otimizadas.
- `public/` para arquivos servidos como estão: favicon, robots, vídeos, logos estáticos, assets que precisam de URL fixa.
- `loading="eager"` só para imagem LCP/hero/autoria crítica.
- `loading="lazy"` para o resto.
- Sempre `alt` significativo; `alt=""` só para decoração.
- Defina `widths` e `sizes` em imagens responsivas.
- Vídeos decorativos devem ter `aria-hidden="true"`, `muted`, `playsinline`, `preload="metadata"` e fallback visual aceitável.

Pattern:

```astro
---
import { Picture } from "astro:assets";
import cover from "../assets/cover.png";
---

<Picture
   src={cover}
   alt="Descrição objetiva"
   formats={["webp"]}
   widths={[640, 960, 1280]}
   sizes="(min-width: 768px) 50vw, 100vw"
   loading="lazy"
   decoding="async"
/>
```

## Tailwind e UI

A landing importa `@tooling/css/globals.css` no layout base.

Regra principal: **use sempre componentes de `@packages/ui` quando existir componente equivalente**. Isso vale para `.astro` server-rendered e para React islands.

Use HTML cru apenas para semântica/layout simples sem primitiva equivalente no design system, como `section`, `article`, `header`, `main`, `nav`, `ul`, `li`, `time`, `picture`/`source`, `video` e wrappers estruturais.

Regras Montte continuam valendo:

- Botões, alerts, fields, inputs, cards, badges, empty states, dialogs/sheets e demais primitivas visuais devem vir de `@packages/ui`.
- Não recrie shadcn/Radix localmente dentro da landing.
- Não importe primitives Radix diretamente.
- Não crie componente visual custom se `@packages/ui` já cobre o caso.
- Em `.astro`, prefira componentes Astro/SSR de `@packages/ui` quando disponíveis; se só existir versão React e houver interação real, use como island com a diretiva `client:*` mais preguiçosa possível.
- Sem margin utilities (`m-`, `mt-`, `mx-`, `space-x-*`, `space-y-*`); use `gap-*`.
- Somente `gap-2` ou `gap-4` quando estiver editando código sujeito ao padrão global. Preserve padrões existentes se o escopo não for refactor de design.
- Spacing/sizing com sufixos `2` e `4` em código novo, salvo necessidade visual já existente na landing.
- Componentes de uma rota podem ficar em diretórios locais ou `blocks/` se forem blocos de landing.
- Componentes compartilhados devem ser pequenos e explícitos. Sem barrels novos.

## Environment variables

Astro suporta schema de env em `astro.config.mjs` via `env.schema`.

No Montte landing:

```typescript
env: {
   schema: {
      PUBLIC_POSTHOG_KEY: envField.string({
         context: "client",
         access: "public",
      }),
      PUBLIC_POSTHOG_HOST: envField.string({
         context: "client",
         access: "public",
      }),
   },
},
```

Regras:

- Variáveis públicas devem começar com `PUBLIC_` e ser declaradas no schema quando usadas pelo client.
- Segredos server-only devem ficar em `process.env` apenas no servidor/endpoints.
- Não exponha `ARCJET_KEY`, `POSTHOG_KEY` server-only ou tokens no client.
- `project.json` deve listar env vars que afetam build cache Nx.
- Se uma env pública nova altera build, adicione em `apps/landing/project.json` inputs.

## Prefetch e navegação

O projeto usa:

```typescript
prefetch: { defaultStrategy: "viewport" }
```

Regras:

- Prefetch melhora navegação MPA, mas pode aumentar requisições.
- Para links muito numerosos ou não prioritários, avalie opt-out/estratégia antes de adicionar grandes listas.
- Links internos devem ser `<a href="/...">` normais, não router client-side customizado.
- Não transforme landing em SPA.

## Performance

Checklist antes de fechar mudança:

- A página continua funcionando sem JS quando possível.
- Islands estão no menor escopo possível.
- Diretiva `client:*` é a mais preguiçosa compatível com UX.
- Imagem LCP não está lazy.
- Imagens abaixo da dobra estão lazy.
- Vídeos decorativos usam `preload="metadata"`.
- Dados de blog são carregados no build, não via fetch client-side.
- Não há pacote React novo para algo que `.astro` resolve.
- Não há dynamic import novo.

## Segurança e privacidade

- Endpoints públicos devem validar payload e método.
- Use Arcjet apenas no servidor.
- Não logue email bruto; use hash truncado quando necessário.
- Não retorne detalhes internos de provider para o browser.
- Mensagens de erro devem ser acionáveis e em pt-BR.
- Use headers corretos de content type.
- CSP do Astro 6 existe, mas só adote quando houver plano específico para scripts inline atuais (`JSON-LD`, PostHog, fontes, etc.).

## Dependências e integrações

Ao adicionar dependência para landing:

1. Adicione em `apps/landing/package.json` com catalog correto do root `package.json`.
2. Se for integração Astro, configure em `astro.config.mjs`.
3. Rode `bun nx sync` se necessário.
4. Rode validação focada.

Integrações atuais:

- `@astrojs/react`: islands React.
- `@astrojs/mdx`: posts MDX.
- `@astrojs/sitemap`: sitemap.
- `@astrojs/node`: on-demand routes em Node standalone.
- `@arcjet/astro`: proteção/validação de email.
- `@tailwindcss/vite`: Tailwind.

## Não fazer

- Não usar Astro como SPA.
- Não hidratar tudo com React.
- Não usar `client:load` por padrão.
- Não recriar componente visual que já existe em `@packages/ui`.
- Não importar primitives Radix diretamente.
- Não criar endpoint on-demand sem `prerender = false`.
- Não usar `try/catch` em código novo.
- Não lançar string/objeto cru.
- Não duplicar ordenação/categorias de blog fora de helpers.
- Não criar barrel files.
- Não editar arquivos gerados `.astro/*`.
- Não colocar segredos em `PUBLIC_*`.
- Não mover produto autenticado para landing.

## Validação

Validação mínima para mudança em Astro:

```bash
bun --filter landing typecheck
bun --filter landing check
bun --filter landing build
git diff --check
```

Para mudança só de Markdown/blog, ainda rode pelo menos:

```bash
bun --filter landing typecheck
bun --filter landing build
```

## Fontes

- Astro Components: https://docs.astro.build/en/basics/astro-components/
- Astro Pages and routing: https://docs.astro.build/en/basics/astro-pages/
- Routing reference: https://docs.astro.build/en/reference/routing-reference/
- Front-end frameworks and islands: https://docs.astro.build/en/guides/framework-components/
- Template/client directives: https://docs.astro.build/en/reference/directives-reference/
- On-demand rendering: https://docs.astro.build/en/guides/on-demand-rendering/
- Server islands: https://docs.astro.build/en/guides/server-islands/
- Content collections: https://docs.astro.build/en/guides/content-collections/
- Content Loader API: https://docs.astro.build/en/reference/content-loader-reference/
- Astro v6 upgrade guide: https://docs.astro.build/en/guides/upgrade-to/v6/
- Astro v6 release notes: https://astro.build/blog/astro-6/
- Environment variables: https://docs.astro.build/en/guides/environment-variables/
- Images: https://docs.astro.build/en/guides/images/
- Prefetch: https://docs.astro.build/en/guides/prefetch/
- React integration: https://docs.astro.build/en/guides/integrations-guide/react/
- Node adapter: https://docs.astro.build/en/guides/integrations-guide/node/
- Configuration reference: https://docs.astro.build/en/reference/configuration-reference/

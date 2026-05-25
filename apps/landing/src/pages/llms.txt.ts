import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import dayjs from "dayjs";
import { getDocPath, sortDocs } from "../lib/docs";

export const prerender = true;

const SITE = "https://montte.co";

export const GET: APIRoute = async () => {
   const posts = (await getCollection("blog")).sort(
      (a, b) => b.data.publishedAt.getTime() - a.data.publishedAt.getTime(),
   );
   const docs = sortDocs(await getCollection("docs"));

   const lines: string[] = [];
   lines.push("# Montte");
   lines.push("");
   lines.push(
      "> Plataforma operacional brasileira com IA nativa para gestão financeira, contatos, serviços e cobranças recorrentes. Esta é a fonte canônica em markdown para LLMs.",
   );
   lines.push("");
   lines.push(`Site: ${SITE}`);
   lines.push(`Repositório: https://github.com/Montte-erp/montte-nx`);
   lines.push("");
   lines.push("## Documentação");
   lines.push("");

   for (const doc of docs) {
      const url = `${SITE}${getDocPath(doc)}`;
      const date = dayjs(doc.data.updatedAt).format("YYYY-MM-DD");
      lines.push(
         `- [${doc.data.title}](${url}) — ${doc.data.category} — atualizado em ${date} — ${doc.data.aiSummary}`,
      );
      if (doc.data.commonQuestions.length > 0) {
         for (const question of doc.data.commonQuestions) {
            lines.push(`  - Pergunta comum: ${question}`);
         }
      }
   }

   lines.push("");
   lines.push("## Blog");
   lines.push("");

   for (const post of posts) {
      const url = `${SITE}/blog/${post.id}`;
      const date = dayjs(post.data.publishedAt).format("YYYY-MM-DD");
      lines.push(
         `- [${post.data.title}](${url}) — ${date} — ${post.data.description}`,
      );
      if (post.data.keyTakeaways?.length) {
         for (const t of post.data.keyTakeaways) {
            lines.push(`  - ${t}`);
         }
      }
   }

   lines.push("");
   lines.push("## Links principais");
   lines.push(`- Documentação: ${SITE}/docs`);
   lines.push(`- Waitlist: ${SITE}/#waitlist`);
   lines.push(`- Sitemap: ${SITE}/sitemap-index.xml`);
   lines.push("");

   return new Response(lines.join("\n"), {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
   });
};

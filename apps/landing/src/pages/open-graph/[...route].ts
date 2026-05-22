import { OGImageRoute } from "astro-og-canvas";
import { getCollection } from "astro:content";

const posts = await getCollection("blog");

const landingPages = {
   montte: {
      title: "Montte: infraestrutura AI-native para serviços recorrentes",
      description:
         "Cobrança, clientes, uso, pendências e financeiro em uma infraestrutura fácil de implementar para SaaS, coworkings e serviços recorrentes.",
   },
   blog: {
      title: "Blog do Montte",
      description:
         "Releases, decisões de produto e bastidores da infraestrutura AI-native para serviços recorrentes.",
   },
};

const pages = {
   ...landingPages,
   ...Object.fromEntries(posts.map((post) => [post.id, post.data])),
};

export const { getStaticPaths, GET } = OGImageRoute({
   param: "route",
   pages,
   getImageOptions: (_path, page) => ({
      title: page.title,
      description: page.description,
      bgGradient: [
         [12, 83, 67],
         [10, 30, 25],
      ],
      border: { color: [12, 83, 67], width: 16 },
      padding: 80,
      font: {
         title: {
            color: [255, 255, 255],
            families: ["Instrument Serif", "serif"],
            weight: "Bold",
            size: 72,
            lineHeight: 1.1,
         },
         description: {
            color: [220, 220, 220],
            families: ["Inter", "sans-serif"],
            weight: "Normal",
            size: 28,
            lineHeight: 1.4,
         },
      },
   }),
});

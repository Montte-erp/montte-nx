import { webSearchTool } from "@tanstack/ai-openrouter/tools";

export function buildWebSearchTool() {
   return webSearchTool({
      engine: "native",
      maxResults: 5,
      searchPrompt:
         "Busque fontes atuais e confiáveis. Resuma em pt-BR e cite links quando a resposta depender de informação externa ou recente.",
   });
}

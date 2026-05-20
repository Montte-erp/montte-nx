# Review Comments

Use para comments de PR, lista de findings, bug reportado, screenshot com denuncia de comportamento ou pedido de "fix only still-valid".

## Workflow verify-first

1. Liste os itens e preserve o texto/arquivo citado.
2. Leia o arquivo atual antes de editar.
3. Busque o mesmo padrao no fluxo dono somente quando isso pode afetar a correcao do item.
4. Antes de patch, escreva a classificacao mental:
   - `valido`: reproduz ou o codigo atual confirma.
   - `stale`: ja corrigido, arquivo mudou, feature removida ou comentario cita API antiga.
   - `duplicado`: outro item cobre a mesma causa.
   - `nao reproduz`: comportamento atual/E2E contradiz o report.
   - `parcial`: parte do report vale, parte nao.
   - `fora de escopo`: exige decisao/produto/PR separado.
5. Patch minimo para `valido` e `parcial`.
6. Finalize com disposicao item a item quando o usuario passou uma lista.

## Escopo

- Corrigir a causa, nao so o sintoma, mas sem varrer o repositorio inteiro.
- Se a logica duplicada no mesmo dominio recalcula o mesmo valor, verifique o helper/service correspondente antes de parar.
- Se comentario cita doc antiga e a branch removeu a feature, a branch atual vence.
- Se screenshot e fonte da verdade, confira alinhamento/renderizacao real alem da logica.

## Anti-padroes

- "Mesmo padrao em outro arquivo" nao autoriza limpeza ampla sem pedido.
- Comentario stale nao deve virar rewrite defensivo.
- Nits de hooks/tipos/layout pedem a menor correcao exata.
- Se `nx sync` ou gerados mudarem por ruído, isole e explique.

## Fechamento esperado

Use pt-BR e seja direto:

- Corrigido: arquivo + comportamento.
- Pulado: item + motivo curto.
- Validacao: comandos rodados.
- Se algo falhou por ambiente/preexistente, diga qual comando falhou e por que nao bloqueia o patch.

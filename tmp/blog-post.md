# Removemos o CRM do Montte. E foi uma decisão deliberada.

**Draft pronto para aprovação — rota canônica: `/blog/removemos-o-crm`**

Todo ERP brasileiro tem CRM ou algo equivalente para gestão de relacionamento. E o Montte acabou de remover o próprio módulo de Contatos/CRM.

É uma frase que parece provocação. Não é provocação — é um relato honesto de decisão de produto.

## O que tinha lá

Até agora, o módulo de contatos entregava um conjunto funcional: cadastro, propriedades, listagem, colunas, configurações, onboarding dedicado e vínculo com transações.

No Git, isso virou uma mudança real, não cosmética:

- hash: `019ce11b`
- mensagem: `Remove contacts module`
- **3.081 linhas removidas**
- **37 arquivos**

Ou seja, tiramos uma superfície de produto que já existia há meses e que havia sido útil em vários fluxos.

## A pergunta que não respondemos antes

A pergunta incômoda foi: **"se todo ERP tem CRM, por que remover o nosso?"**

A resposta começa com uma distinção:

- _ter CRM_ é quase padrão de produto;
- _usar CRM bem_ é outra discussão, e não necessariamente no mesmo produto.

Não tiramos relacionamento do Montte para ignorar clientes de CRM. Tiramos porque, olhando para operação real e sinal de uso, era uma área que crescia em complexidade sem transformar o que já nos distinguia.

## Verificação: a decisão foi checada

Não se trata de opinião de mesa. Fizemos uma validação objetiva de mercado para evitar decisão baseada em ego.

### ERPs (evidência consultada)

| ERP | CRM nativo? | Evidência |
|---|---|---|
| Bling | Sim | Módulo CRM/Relacionamento |
| Omie | Sim | CRM nativo com funil |
| Conta Azul | Sim | Gestão de clientes + integrações |
| Tiny | Sim | CRM com kanban e WhatsApp |
| NetSuite | Sim | CRM nativo |
| Odoo | Sim | App CRM nativo |

Também revisamos referências fora do core brasileiro:

- **SAP B1**: sem CRM nativo, via add-on/integração.
- **Zoho**: produto separado de CRM.

A leitura que faz sentido é menos “todo ERP é único” e mais: **em muitos ERPs maduros, CRM é uma função de pacote esperada, não um diferencial técnico de posicionamento**.

## Por que quebrar esse padrão (3 razões)

Essa parte é a mais importante do post.

### 1) Foco no que o Montte já faz melhor

Nosso núcleo é financeiro: controle, classificação, consistência operacional, decisão com clareza. Mantendo CRM interno, a equipe ficou dividida entre resolver dores de contabilidade e problemas de conversão comercial.

Não havia má qualidade no CRM, havia risco de dispersão estratégica. E produto bom é raro quando tenta fazer tudo ao mesmo tempo.

### 2) Manutenção estava com custo alto para retorno baixo

Cada nova regra de contato, cada ajuste de integração e cada correção de borda tinha impacto no ciclo de entrega.

Quando a base já usa ferramentas comerciais maduras, o ganho adicional do CRM interno pode ser marginal, enquanto o custo de manter evolução e suporte cresce. A balança não fechava para o valor entregue ao usuário final.

### 3) A direção futura é conversa, não formulário

A arquitetura que mais funcionou no Montte até aqui é simplificar a entrada de operação.

Em vez de “onde clicar?” o usuário passa a perguntar “o que eu preciso fazer agora?”.

Esse alinhamento só é sustentável com um produto menos fragmentado em telas e com fluxo orientado por linguagem e contexto.

## O que veio no lugar: Montte AI / chat-first

Remoção sem reposição seria falha de produto.

A reposição é direta: migramos capacidade para o que chamamos de operação **chat-first**. Em vez de abrir uma tela de contatos para atualizar contexto, o usuário interage de forma mais natural por conversa e executa tarefas com menos saltos de interface.

Essa escolha não elimina relacionamento, apenas desloca o ponto certo de responsabilidade: Montte se mantém firme no que deveria ser o coração financeiro, enquanto ferramentas dedicadas de CRM podem continuar fazendo melhor o trabalho comercial.

## O que aprendemos

Essa é a lição menos glamourosa e mais útil:

**A decisão difícil não é criar mais uma feature. É saber que não criar também é uma decisão de produto.**

Também aprendemos o óbvio que a pressa costuma esconder:

- benchmark público reduz viés interno;
- menos escopo pode gerar mais consistência;
- tom de comunicação precisa ser honesto, especialmente com quem era usuário do módulo.

Temos um ponto sensível em aberto: o `MON-1106` com acompanhamento de schema residual e ajuste de comunicação no changelog para clientes atuais.

## CTA suave

Não vendemos essa escolha como “coragem”. Vendemos como clareza.

Se o seu time já sente que produto bom é o que elimina atrito e entrega menos ruído, isso aqui pode fazer sentido. O objetivo é simples: **menos camadas, mais foco no que cria valor real no dia a dia.**

Se curte esse tipo de transparência de produto, acompanha o post completo, comenta se concorda e segue os próximos updates do Montte.
